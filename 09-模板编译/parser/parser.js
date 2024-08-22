/** vue对模板编译后的AST大概结构：
{
    children: [{…}],
    parent: {},
    tag: "div",
    type: 1, // 1-元素节点 2-带变量的文本节点 3-纯文本节点，
    expression:'_s(name)', //type如果是2，则返回_s(变量)
    text:'{{name}}' //文本节点编译前的字符串
}
 **/
/**
大概实现思路：
 1. 遍历到开始标签（'<'）时，入栈(树的层级多了一层)
 2. 遍历到结束标签('/>')时，出栈，退回上一级
 3. 如果是纯文本节点，不对栈进行操作
**/
function parser(html) {
    let stack = [];
    let root;
    let currentParent;
    while (html) {
        let lIndex = html.indexOf('<');
        if (lIndex > 0) { // 如果'<'不在最开头，代表前面有纯文本节点
            const text = html.slice(0, lIndex);
            const elements = parserText(text);
            elements.parent = currentParent;
            currentParent.children.push(elements);
            html = html.slice(lIndex);
        } else if (html[lIndex + 1] !== '/') { // 如果当前字符的后一个字符不是'/'，代表不是结束标签，是开始标签
            const gIndex = html.indexOf('>');
            const elements = {
                type: 1,
                tag: html.slice(lIndex + 1, gIndex),
                parent: currentParent,
                children: [],
            };
            if (!root) {
                root = elements;
            } else {
                currentParent.children.push(elements);
            }
            stack.push(elements);
            currentParent = elements;
            html = html.slice(gIndex + 1);
        } else { // 代表是结束标签
            const gIndex = html.indexOf('>');
            stack.pop();
            currentParent = stack[stack.length - 1]; // 栈推出后，当前父节点就是栈顶的元素
            html = html.slice(gIndex + 1);
        }
    }
    return root;
}

// 编译文本节点;
// 1. 带变量的文本节点：_s(name)  type =2
// 2. 纯文本节点 type = 3
function parserText(text) {
    let originalText = text;
    let tokens = [];
    let type = 3;
    while (text) {
        const startIndex = text.indexOf('{{');
        const endIndex = text.indexOf('}}');
        if (startIndex !== -1 && endIndex !== -1) {
            type = 2;
            if (startIndex > 0) { // 如果大于0，说明在带变量的节点前面还有纯文本节点
                tokens.push(JSON.stringify(text.slice(0, startIndex)));
            }
            let exp = text.slice(startIndex + 2, endIndex);
            tokens.push(`_s(${exp})`);
            text = text.slice(endIndex + 2);
        } else {
            tokens.push(JSON.stringify(text));
            text = '';
        }
    }
    let element = {
        type,
        text: originalText,
    };
    type === 2 ? element.expression = tokens.join('+') : '';
    return element;
}