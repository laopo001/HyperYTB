import { getText } from "../pages/locale"

let t = getText('default')
export const languageOptions = [{ label: t`中文`, value: "zh" }, { label: t`英文`, value: "en" }, { label: t`日文`, value: "ja" }]