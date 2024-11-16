import { YAML, fs, argv } from "zx";
import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: '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', // This is the default and can be omitted
});

const openai2 = new OpenAI({
    baseURL: 'https://oneapi.dadigua.men/v1',
    apiKey: 'sk-qarAYUXdGkvcYBfE3a3e96BeFeCd4fE794F0417e1a08C2Ab',
});

if (argv.t) {
    let json = JSON.parse(fs.readFileSync('./tmp/lang.json').toString());
    for (let page in json.text) {
        for (let key in json.text[page]) {
            if (json.text[page][key] == "") {
                json.text[page][key] = {
                    'zh': key,
                    'en': await translate(key)
                }
            }
        }
    }
    fs.writeFileSync('./tmp/lang.translate.json', JSON.stringify(json, null, 2))
}

// let o = YAML.parse(fs.readFileSync('./src/pages2/text.yaml').toString());
// fs.writeFileSync('./src/pages2/text.json', JSON.stringify(o, null, 2))


export async function translate(content) {
    content = `下面我让你来充当翻译家，你的目标是把任何语言翻译成英文，请翻译时不要带翻译腔，而是要翻译得自然、流畅和地道，使用优美和高雅的表达方式。请翻译下面这句话："${content}"`;
    const chatCompletion = await openai2.chat.completions.create({
        messages: [{
            role: 'user', content: content
        }],
        model: 'gpt-4',
    }).catch(err => {
        return openai.chat.completions.create({
            messages: [{
                role: 'user', content: content
            }],
            model: 'gpt-3.5-turbo',
        }) as any
    });
    return chatCompletion.choices[0].message.content.replace(/^"|"$/g, '');
}