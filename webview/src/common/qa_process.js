import { fs, os, sleep, retry, path } from "zx";
import crypto from "crypto";
import { request } from "./request.mjs";

class QaModule {
    constructor() {
        // 暂时不需要
        this.voice_module_name = "";
        this.video_module_name = "";
        this.video_path = "";
    }
}

class QaAnswer {
    constructor() {
        // 回答实际的内容
        this.answer = "";
        // 表示每个回答的视频信息（数字人模型+语音模型确定一个视频）,key是数字人模型_语音模型，value是视频路径
        this.answer_module_data = {};
    }

    toDict() {
        return {
            answer: this.answer,
            answer_module_data: this.answer_module_data,
        };
    }

    static fromDict(data) {
        const obj = new QaAnswer();
        obj.answer = data.answer;
        obj.answer_module_data = data.answer_module_data;
        return obj;
    }
}

class QaRuleMatchWord {
    constructor() {
        // 每个词实际的内容
        this.word = "";
        // 是否有!前缀
        this.is_not = false;
    }

    toDict() {
        return {
            word: this.word,
            is_not: this.is_not,
        };
    }

    static fromDict(data) {
        const obj = new QaRuleMatchWord();
        obj.word = data.word;
        obj.is_not = data.is_not;
        return obj;
    }
}

class QaRuleMatch {
    constructor() {
        // 每个元素是QaRuleMatchWord类型，表示每个词，按&&分割
        this.match_words = [];
    }

    toDict() {
        return {
            match_words: this.match_words.map(word => word.toDict()),
        };
    }

    static fromDict(data) {
        const obj = new QaRuleMatch();
        obj.match_words = data.match_words.map(wordData => QaRuleMatchWord.fromDict(wordData));
        return obj;
    }
}

class QaRule {
    constructor() {
        // 回答map，每个元素key是回答的 md5，value是QaAnswer类型，包括回答内容和视频信息
        this.answer = {};
        // 匹配规则，按||分割后的每个子串, 元素是QaRuleMatch类型
        this.rule_match = [];
    }

    toDict() {
        return {
            answer: Object.fromEntries(Object.entries(this.answer).map(([key, answer]) => [key, answer.toDict()])),
            rule_match: this.rule_match.map(match => match.toDict()),
        };
    }

    static fromDict(data) {
        const obj = new QaRule();
        obj.answer = Object.fromEntries(Object.entries(data.answer).map(([key, answerData]) => [key, QaAnswer.fromDict(answerData)]));
        obj.rule_match = data.rule_match.map(matchData => QaRuleMatch.fromDict(matchData));
        return obj;
    }
}

class QaData {
    constructor() {
        // key是规则名，value 是QaRule规则详情（回答 list 和匹配规则）
        this.rule = {};
    }

    toDict() {
        return {
            rule: Object.fromEntries(Object.entries(this.rule).map(([key, rule]) => [key, rule.toDict()])),
        };
    }

    static fromDict(data) {
        const obj = new QaData();
        obj.rule = Object.fromEntries(Object.entries(data.rule).map(([key, ruleData]) => [key, QaRule.fromDict(ruleData)]));
        return obj;
    }
}

export class QaProcess {
    constructor() {
        this.conf_path = "";
        this.video_path = "";
        // key是包名，value 是QaData规则
        this.data = {};
        this.now_package_name = "";
        this.now_video_module_name = "";
        this.now_voice_module_name = "";
    }

    init(conf_path, video_path) {
        this.conf_path = conf_path;
        this.video_path = video_path;
        this.load();
    }

    toDict() {
        return {
            data: Object.fromEntries(Object.entries(this.data).map(([key, data]) => [key, data.toDict()])),
        };
    }

    load() {
        if (!fs.existsSync(this.conf_path)) {
            return false;
        }
        // 从文件中加载问答库数据到服务中
        const data = JSON.parse(fs.readFileSync(this.conf_path, 'utf-8'));
        this.data = Object.fromEntries(Object.entries(data.data).map(([key, dataData]) => [key, QaData.fromDict(dataData)]));
        return true;
    }

    store() {
        // 把问答库持久化到文件中
        fs.writeFileSync(this.conf_path, JSON.stringify(this.toDict(), null, 2));
    }

    match(question) {
        try {
            const qa_data = this.data[this.now_package_name];
            for (const rule_value of Object.values(qa_data.rule)) {
                if (Object.keys(rule_value.answer).length === 0) {
                    continue;
                }
                let is_match = false;
                for (const rule_match of rule_value.rule_match) {
                    let match_amount = 0;
                    for (const word of rule_match.match_words) {
                        if (question.includes(word.word) && !word.is_not) {
                            match_amount++;
                        } else if (!question.includes(word.word) && word.is_not) {
                            match_amount++;
                        }
                    }
                    if (match_amount === rule_match.match_words.length) {
                        // 匹配成功，随机返回规则中的answer
                        const answers = Object.values(rule_value.answer);
                        const randomIndex = Math.floor(Math.random() * answers.length);
                        const qa_answer = answers[randomIndex];
                        const module_key = `${this.now_video_module_name}_${this.now_voice_module_name}`;
                        return qa_answer.answer_module_data[module_key];
                    }
                }
            }
        } catch (e) {
            console.error('error:', e)
        }
        
        return "";
    }

    getRuleMatch(rule) {
        const rule_match = [];
        const parts = rule.split('||').map(part => part.trim());
        for (const part of parts) {
            const qa_rule_match = new QaRuleMatch();
            const words = part.split('&&').map(item => item.trim());
            for (const word of words) {
                const qa_word = new QaRuleMatchWord();
                if (word.startsWith('!')) {
                    qa_word.word = word.substring(1);
                    qa_word.is_not = true;
                } else {
                    qa_word.word = word;
                }
                qa_rule_match.match_words.push(qa_word);
            }
            rule_match.push(qa_rule_match);
        }
        return rule_match;
    }

    opt(data_type, opt_type, package_name, rule_name = "", answer = "", answer_id = "") {
        // data_type: 1-问答包; 2-规则; 3-回答
        // opt_type: 1-新增; 2-删除; 3-查询
        try {
            if (data_type === 1) {
                if (opt_type === 1) {
                    const qa_data = new QaData();
                    this.data[package_name] = qa_data;
                } else if (opt_type === 2) {
                    delete this.data[package_name];
                } else if (opt_type === 3) {
                    return Object.keys(this.data);
                }
            } else if (data_type === 2) {
                if (opt_type === 1) {
                    const qa_data = this.data[package_name];
                    const qa_rule = new QaRule();
                    qa_rule.rule_match = this.getRuleMatch(rule_name);
                    qa_data.rule[rule_name] = qa_rule;
                } else if (opt_type === 2) {
                    const qa_data = this.data[package_name];
                    delete qa_data.rule[rule_name];
                } else if (opt_type === 3) {
                    const qa_data = this.data[package_name];
                    return Object.keys(qa_data.rule);
                }
            } else if (data_type === 3) {
                if (opt_type === 1) {
                    const qa_rule = this.data[package_name].rule[rule_name];
                    const answer_id = crypto.createHash('md5').update(answer).digest('hex');
                    const qa_answer = new QaAnswer();
                    qa_answer.answer = answer;
                    qa_rule.answer[answer_id] = qa_answer;
                    console.log(`insert answer, key:${answer_id}, value:${answer}`);
                } else if (opt_type === 2) {
                    const qa_rule = this.data[package_name].rule[rule_name];
                    delete qa_rule.answer[answer_id];
                } else if (opt_type === 3) {
                    const qa_rule = this.data[package_name].rule[rule_name];
                    return Object.entries(qa_rule.answer).map(([key, answer]) => ({ key, answer: answer.answer }));
                }
            } else if (data_type === 0 && opt_type === 3) {
                return this.toDict();
            }

            if (opt_type === 1 || opt_type === 2) {
                this.store();
            }
        } catch (e) {
            console.error('error:', e)
        }
        
    }

    generate(package_name, voice_module_name, video_module_name) {
        // 返回对应的包的所有回答要生成的视频
        this.now_package_name = package_name;
        this.now_video_module_name = video_module_name;
        this.now_voice_module_name = voice_module_name;
        const module_key = `${video_module_name}_${voice_module_name}`;

        var result = [];
        try {
            const qa_data = this.data[package_name];
            for (const qa_rule of Object.values(qa_data.rule)) {
                for (const qa_answer of Object.values(qa_rule.answer)) {
                    if (!(module_key in qa_answer.answer_module_data)) {
                        // 生成语音和数字人视频，放到answer_module_data中
                        const file_path = `${this.video_path}\\${Date.now()}`;
                        //const voice_file = `${file_path}.mp3`;
                        
                        //var voice_params = { "speak_module": this.now_voice_module_name, "text": qa_answer.answer, "language": "zh", "voice_path": voice_file }
                        //const voive_resp = request('/text_to_speak', { method: "post", json: voice_params })

                        //const video_file = `${file_path}.mp4`;
                        //var video_params = { "human_module": this.now_video_module_name, "voice_path": voice_file, "video_path": video_file }
                        //const video_resp = request('/gen_metahuman_video', { method: "post", json: video_params })
                        const video_file = `${file_path}.mp4`;
                        var data = {'text': qa_answer.answer, 'voice_module':voice_module_name, "language": "zh", 'video_module':video_module_name, 'video_file':video_file};
                        result.push(data)
                        qa_answer.answer_module_data[module_key] = video_file;
                    }
                }
            }
        } catch (e) {
            console.error('error:', e)
        }
        this.store();
        return result
    }
}
