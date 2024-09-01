// Model's status: https://status.g4f.icu/status/ai
const API = "https://free.netfly.top/api/openai/v1/chat/completions";
const CORS_API_HOST = 'https://cors-proxy.fringe.zone/';
const PAYLOADS = {
    "frequency_penalty": 0,
    "messages": [
        {
            "role": "system",
            "content": "You are ChatGPT, a large language model trained by OpenAI."
        }
    ],
    "model": "gpt-3.5-turbo",
    "presence_penalty": 0,
    "stream": true,
    "temperature": 0.5,
    "top_p": 1
};

class GPT {
    constructor(model = 'gpt-4', instructor = "", q = "user", a = "assistant") {
        this.q = q;
        this.a = a;
        PAYLOADS.model = model;
        if (instructor) {
            PAYLOADS.messages[0].content = instructor;
        }
    }

    async inference() {
        let tries = 7;
        while (tries) {
            try {
                const response = await fetch(CORS_API_HOST + API, {
                    method: 'POST',
                    body: JSON.stringify(PAYLOADS)
                });
                const response_text = await response.text();
                if (response_text.includes('You are asking too frequently, please take a break')) {
                    throw new Error('Too many requests!');
                }
                const response_lines = response_text.split('data:');
                let response_final = '';
                for (const line of response_lines) {
                    try {
                        const content = JSON.parse(line)['choices'][0]['delta']['content'];
                        if (content) response_final += content;
                    }
                    catch {
                        continue;
                    }
                }
                if (response_final.includes('Sorry, your request has been denied.')) {
                    throw new Error('Request denied!');
                }
                if (!response_final) {
                    throw new Error('Response is invalid!');
                }
                if (PAYLOADS.model == 'gpt-4' && response_final.startsWith('Answer: """')) {
                    return response_final.slice('Answer: """'.length, -3);
                }
                return response_final;
            }
            catch (err) {
                console.log(err);
                if (!(--tries)) {
                    return 'An unexpected error occured, please try again!';
                }
            }
        }
    }

    async prompt(user_input) {
        PAYLOADS.messages.push({ 'role': this.q, 'content': user_input });
        const llm_output = await this.inference();
        PAYLOADS.messages.push({ 'role': this.a, 'content': llm_output });
        return llm_output;
    }
}

function loadChatHistoryList() {
    const tmp = localStorage.getItem('chatData');
    if (tmp) {
        for (const data of JSON.parse(tmp)) {
            const li = document.createElement('li');
            li.innerHTML = `
                <div>
                    <span>${data.title.replaceAll('<', '&lt;').replaceAll('>', '&gt;')}</span>
                    <div class="fade-layer"></div>
                </div>
                <button class="option-btn" title="Rename">
                    <i class="fa fa-pencil" aria-hidden="true"></i>
                </button>
                <button class="option-btn" title="Delete">
                    <i class="fa fa-trash-o" aria-hidden="true"></i>
                </button>`;
            li.title = data.title;
            li.lastElementChild.previousElementSibling.addEventListener('click', renameChatHistory);
            li.lastElementChild.addEventListener('click', deleteChatHistory);
            li.addEventListener('click', requestLoadChatHistory);
            chatHistoryList.appendChild(li);
        }
    }
    else {
        localStorage.setItem('chatData', '[]');
    }
}

function loadChatHistory(title) {
    const chatData = JSON.parse(localStorage.getItem('chatData'));
    for (const data of chatData) {
        if (data.title == title) {
            messagesBox.innerHTML = '';
            messagesBox.scrollTop = 0;
            const messages = data.messages;
            for (let i = 1; i < messages.length; i += 2) {
                const userMessage = document.createElement('output');
                const modelMessage = document.createElement('output');
                userMessage.innerHTML = messages[i].content.replaceAll('<', '&lt;').replaceAll('>', '&gt;');
                modelMessage.innerHTML = marked(messages[i + 1].content);
                userMessage.setAttribute('class', 'user-message');
                modelMessage.setAttribute('class', 'model-message');
                messagesBox.append(userMessage, modelMessage);
            }
            hljs.highlightAll();
            messagesBox.scrollTop = messagesBox.scrollHeight;
            PAYLOADS.messages = messages;
            break;
        }
    }
}

function saveChatHistory(title) {
    const chatData = JSON.parse(localStorage.getItem('chatData'));
    for (const data of chatData) {
        if (data.title == title) {
            data.messages = PAYLOADS.messages;
            localStorage.setItem('chatData', JSON.stringify(chatData));
            break;
        }
    }
}

function addChatHistory(title) {
    const chatData = JSON.parse(localStorage.getItem('chatData'));
    const li = document.createElement('li');
    if (chatHistoryList.firstElementChild) {
        chatHistoryList.firstElementChild.insertAdjacentElement('beforebegin', li);
    }
    else {
        chatHistoryList.appendChild(li);
    }
    li.setAttribute('class', 'active');
    li.addEventListener('click', requestLoadChatHistory);

    title = handleDuplicatedTitle(nlp(title).terms().forEach((w) => {
        if (!w.has('#Determiner') && !w.has('#Conjunction') && !w.has('#Preposition')) w.toTitleCase();
    }).text(), chatData);
    chatData.unshift({ 'title': title, 'messages': '' });
    localStorage.setItem('chatData', JSON.stringify(chatData));

    let i = 0;
    li.innerHTML = `
        <div>
            <span></span>
            <div class="fade-layer"></div>
        </div>
        <button class="option-btn" title="Rename">
            <i class="fa fa-pencil" aria-hidden="true"></i>
        </button>
        <button class="option-btn" title="Delete">
            <i class="fa fa-trash-o" aria-hidden="true"></i>
        </button>`;
    li.title = title;
    li.lastElementChild.previousElementSibling.addEventListener('click', renameChatHistory);
    li.lastElementChild.addEventListener('click', deleteChatHistory);
    title = title.replaceAll('<', '&lt;').replaceAll('>', '&gt;');
    const id = setInterval(() => {
        li.firstElementChild.firstElementChild.innerHTML += title[i++];

        if (i == title.length) {
            clearInterval(id);
        }
    }, 70);
}

function renameChatHistory(e) {
    function reset(title) {
        document.removeEventListener('focusout', handleFocusEvent);
        
        btn.parentElement.title = title;
        btn.parentElement.className = isActive ? 'active' : '';

        btn.previousElementSibling.innerHTML = `
            <span>${title.replaceAll('<', '&lt;').replaceAll('>', '&gt;')}</span>
            <div class="fade-layer"></div>`;

        btn.title = 'Rename';
        btn.firstElementChild.className = 'fa fa-pencil';
        btn.removeEventListener('click', acceptRename);
        btn.addEventListener('click', renameChatHistory);

        btn.nextElementSibling.title = 'Delete';
        btn.nextElementSibling.firstElementChild.className = 'fa fa-trash-o';
        btn.nextElementSibling.removeEventListener('click', cancelRename);
        btn.nextElementSibling.addEventListener('click', deleteChatHistory);
    }

    function acceptRename(e) {
        e.stopPropagation();
        const chatData = JSON.parse(localStorage.getItem('chatData'));
        const name = document.querySelector('.editing input').value.trim();
        if (name) {
            if (name != btn.parentElement.title) {
                let idx;
                for (let i = 0; i < chatData.length; i++) {
                    if (chatData[i].title == btn.parentElement.title) {
                        idx = i;
                        continue;
                    }
                    if (chatData[i].title == name) {
                        alert('This name is already exist!');
                        document.querySelector('.editing input').focus();
                        return;
                    }
                }
                chatData[idx].title = name;
                localStorage.setItem('chatData', JSON.stringify(chatData));
            }
            reset(name);
        }
    }

    function cancelRename(e) {
        e.stopPropagation();
        reset(document.querySelector('.editing').title);
    }

    function handleFocusEvent(e) {
        if (!e.relatedTarget || (e.relatedTarget.className != 'option-btn' && e.relatedTarget != btn.previousElementSibling.firstElementChild)) {
            cancelRename(e);
        }
    }

    e.stopPropagation();

    const btn = e.currentTarget;
    const isActive = btn.parentElement.className == 'active';
    btn.parentElement.className = 'editing';

    btn.previousElementSibling.innerHTML = `<input type="text" value="${btn.parentElement.title}">`;
    btn.previousElementSibling.firstElementChild.addEventListener('keyup', (e) => {
        if (e.key == 'Enter') {
            acceptRename(e);
        }
        else if (e.key == 'Escape') {
            cancelRename(e);
        }
    });
    document.addEventListener('focusout', handleFocusEvent);
    btn.previousElementSibling.firstElementChild.focus();

    btn.title = 'Ok';
    btn.firstElementChild.className = 'fa fa-check';
    btn.removeEventListener('click', renameChatHistory);
    btn.addEventListener('click', acceptRename);

    btn.nextElementSibling.title = 'Cancel';
    btn.nextElementSibling.firstElementChild.className = 'fa fa-times';
    btn.nextElementSibling.removeEventListener('click', deleteChatHistory);
    btn.nextElementSibling.addEventListener('click', cancelRename);
}

function deleteChatHistory(e) {
    e.stopPropagation();
    if (confirm('Do you want to delete this chat history?')) {
        const chatData = JSON.parse(localStorage.getItem('chatData'));
        for (let i = 0; i < chatData.length; i++) {
            if (chatData[i].title == e.currentTarget.parentElement.title) {
                e.currentTarget.parentElement.remove();
                chatData.splice(i, 1);
                localStorage.setItem('chatData', JSON.stringify(chatData));
                break;
            }
        }
    }
}

function requestLoadChatHistory(e) {
    if (!e.currentTarget.classList.length) {
        const curChat = document.querySelector('ul .active');
        if (curChat) {
            curChat.removeAttribute('class');
        }

        e.currentTarget.setAttribute('class', 'active');
        loadChatHistory(e.currentTarget.title);
    }
}

function handleDuplicatedTitle(title, chatData) {
    const exist = [];
    for (const data of chatData) {
        if (data.title == title) {
            exist.push(0);
            continue;
        }
        const tmp = data.title.replace(title, '').match(/(?<=^\s\()(?:\d+)(?=\)$)/);
        if (tmp) {
            exist.push(Number(tmp[0]));
        }
    }
    if (exist.length) {
        exist.sort();
        for (let i = 0; i < exist.length; i++) {
            if (i != exist[i]) {
                if (i) return title + ` (${i})`;
                return title;
            }
        }
        return title + ` (${exist.length})`;
    }
    return title;
}

function displayContents(queue) {
    function displayContent(data) {
        resetDisplayProperty(data.curNode.parentElement);
        data.curNode.parentElement.classList.add('cursor');
        let i = 0;
        const id = setInterval(() => {
            data.curNode.textContent += data.content[i++];
            messagesBox.scrollTop = messagesBox.scrollHeight;

            if (i == data.content.length) {
                data.curNode.parentElement.classList.remove('cursor');
                clearInterval(id);

                if (queue.length) {
                    displayContent(queue.shift());
                }
                else {
                    userInput.removeAttribute('disabled');
                }
            }
        });
    }
    displayContent(queue.shift());
}

function getTextChilds(queue, curNode) {
    function dfs(curNode) {
        if (curNode.nodeName == 'CODE') {
            if (curNode.className.includes('language')) {
                hljs.highlightElement(curNode);
            }
            else {
                curNode.classList.add('hljs');
            }
        }
        for (const child of curNode.childNodes) {
            if (child.nodeType == 3) {
                const content = child.nodeValue;
                if (content == '\n') continue;
                child.nodeValue = '';
                queue.push({ 'curNode': child, 'content': content });
            }
            else {
                child.style.setProperty('display', 'none');
                dfs(child);
            }
        }
    }
    dfs(curNode);
}

function resetDisplayProperty(cur) {
    cur.style.removeProperty('display');
    if (cur.parentElement && cur.parentElement.style.display == 'none') {
        resetDisplayProperty(cur.parentElement);
    }
}

const chatbot = new GPT();
const messagesBox = document.getElementById('messages-box');
const userInput = document.getElementById('user-input');
const showChatHistoryList = document.getElementById('show-chat-history-list');
const hideChatHistoryList = document.getElementById('hide-chat-history-list');
const chatHistoryList = document.getElementById('chat-history-list');

document.getElementById('model').addEventListener('change', (e) => {
    PAYLOADS.model = e.target.value.toLowerCase();
});

userInput.parentElement.addEventListener('submit', (e) => {
    e.preventDefault();
    let input = userInput.value.trim();

    if (input) {
        if (messagesBox.childElementCount == 1) {
            addChatHistory(nlp(input).sentences().data()[0].text);
        }

        userInput.setAttribute('disabled', 'true');
        userInput.nextElementSibling.setAttribute('disabled', 'true');
        messagesBox.lastElementChild.innerHTML = input.replaceAll('<', '&lt;').replaceAll('>', '&gt;');

        const output_model = document.createElement('output');
        output_model.setAttribute('class', 'model-message');
        output_model.innerHTML = `
            <div class="typing">
                <div class="dot"></div>
                <div class="dot"></div>
                <div class="dot"></div>
            </div>`;
        messagesBox.appendChild(output_model);

        messagesBox.scrollTop = messagesBox.scrollHeight;

        chatbot.prompt(input)
            .then(res => {
                saveChatHistory(document.querySelector('ul .active').title);

                const parser = new DOMParser();
                const queue = new Array();

                output_model.innerHTML = '';
                output_model.style.setProperty('display', 'none');
                output_model.append(...parser.parseFromString(marked(res), 'text/html').children[0].children[1].childNodes);

                getTextChilds(queue, output_model);
                output_model.style.removeProperty('display');
                displayContents(queue);
            })
            .catch(err => {
                console.log(err);
                userInput.removeAttribute('disabled');
                messagesBox.lastElementChild.innerHTML = 'An unexpected error occured, please try again!';
            });
        userInput.value = '';
        userInput.style.height = '';
        empty = true;
    }
});

userInput.addEventListener('keypress', (e) => {
    if (e.code == 'Enter' && e.ctrlKey) {
        userInput.parentElement.requestSubmit();
    }
});

let empty = true;
userInput.addEventListener('input', (e) => {
    userInput.style.height = 'fit-content';
    userInput.style.height = userInput.scrollHeight + 'px';

    if (e.inputType.includes('insert') && empty) {
        if (messagesBox.querySelector('#startup-bg')) {
            messagesBox.innerHTML = '';
        }

        empty = false;
        userInput.nextElementSibling.removeAttribute('disabled');

        const output_user = document.createElement('output');
        output_user.setAttribute('class', 'user-message');
        output_user.innerHTML = `
            <div class="typing">
                <div class="dot"></div>
                <div class="dot"></div>
                <div class="dot"></div>
            </div>`;
        messagesBox.appendChild(output_user);
        messagesBox.scrollTop = messagesBox.scrollHeight;
    }
    else if (e.inputType.includes('delete') && userInput.value == '' && !empty) {
        if (messagesBox.childElementCount == 1) {
            messagesBox.innerHTML = '<div id="startup-bg"></div>' + messagesBox.innerHTML;
        }

        empty = true;
        userInput.nextElementSibling.setAttribute('disabled', 'true');
        messagesBox.lastElementChild.remove();
    }
});

showChatHistoryList.addEventListener('click', () => {
    chatHistoryList.parentElement.style.display = 'flex';
    showChatHistoryList.style.display = 'none';

    if (window.innerWidth < 550) {
        messagesBox.parentElement.style.display = 'none';
        chatHistoryList.parentElement.style.width = '100%';
    }
    userInput.style.height = 'fit-content';
    userInput.style.height = userInput.scrollHeight + 'px';
});

hideChatHistoryList.addEventListener('click', () => {
    chatHistoryList.parentElement.style.display = 'none';
    showChatHistoryList.style.display = 'flex';

    if (window.innerWidth < 550) {
        messagesBox.parentElement.style.display = 'flex';
        chatHistoryList.parentElement.style.width = '';
    }
    userInput.style.height = 'fit-content';
    userInput.style.height = userInput.scrollHeight + 'px';
});

window.addEventListener('resize', () => {
    userInput.style.height = 'fit-content';
    userInput.style.height = userInput.scrollHeight + 'px';

    if (chatHistoryList.parentElement.style.display == 'flex') {
        if (window.innerWidth < 550) {
            messagesBox.parentElement.style.display = 'none';
            chatHistoryList.parentElement.style.width = '100%';
        }
        else {
            messagesBox.parentElement.style.display = 'flex';
            chatHistoryList.parentElement.style.width = '';
        }
    }
});

document.getElementById('new-chat-btn').addEventListener('click', () => {
    if (!document.getElementById('startup-bg')) {
        document.querySelector('.active').removeAttribute('class');
        messagesBox.innerHTML = '<div id="startup-bg"></div>';
        PAYLOADS.messages = [
            {
                "role": "system",
                "content": "You're AI Assistant!"
            }
        ];
    }
});

loadChatHistoryList();