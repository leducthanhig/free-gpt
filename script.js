const HEADERS = {
    "authority": "free.netfly.top",
    "method": "POST",
    "path": "/api/openai/v1/chat/completions",
    "scheme": "https",
    "accept": "application/json, text/event-stream",
    "accept-encoding": "gzip, deflate, br, zstd",
    "accept-language": "en-US,en;q=0.9,vi;q=0.8",
    "content-length": "1814",
    "content-type": "application/json",
    "origin": "https://free.netfly.top",
    "priority": "u=1, i",
    "referer": "https://free.netfly.top/",
    "sec-ch-ua": "\"Not)A;Brand\";v=\"99\", \"Google Chrome\";v=\"127\", \"Chromium\";v=\"127\"",
    "sec-ch-ua-mobile": "?1",
    "sec-ch-ua-platform": "\"Android\"",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    "user-agent": "Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36"
};

const PAYLOADS = {
    "frequency_penalty": 0,
    "messages": [
        {
            "role": "system",
            "content": "You're AI Assistant!"
        }
    ],
    "model": "gpt-3.5-turbo",
    "presence_penalty": 1,
    "stream": true,
    "temperature": 0.8,
    "top_p": 0.9
};

const API = "https://free.netfly.top/api/openai/v1/chat/completions";
const CORS_API_HOST = 'https://cors-proxy.fringe.zone/';

class NLP {
    similiary(str1, str2) {
        return stringSimilarity.compareTwoStrings(str1, str2);
    }

    removePunctuation(text) {
        return text.replace(/[^\w\s]/g, '');
    }
}

class GPT {
    constructor(model_name = 'gpt-4', instructor = "", top_p = 0.9, temperature = 0.7, presence_penalty = 0, frequency_penalty = 0, q = 'user', a = 'assistant', payloads = PAYLOADS, api = API, headers = HEADERS) {
        this.model_name = model_name;
        this.instructor = instructor;
        this.top_p = top_p;
        this.temperature = temperature;
        this.presence_penalty = presence_penalty;
        this.frequency_penalty = frequency_penalty;
        this.q = q;
        this.a = a;
        this.payloads = payloads;
        this.api = api;
        this.headers = headers;

        if (this.instructor != "") {
            this.payloads['messages'][0]['content'] = this.instructor;
        }
        this.payloads.presence_penalty = this.presence_penalty;
        this.payloads.temperature = this.temperature;
        this.payloads.top_p = this.top_p;
        this.payloads.frequency_penalty = this.frequency_penalty;
        this.payloads.model = this.model_name;

        this.activateMemoryManager();
    }

    async inference() {
        let response = '';
        try {
            response = await fetch(CORS_API_HOST + this.api, {
                method: 'POST',
                headers: this.headers,
                body: JSON.stringify(this.payloads)
            });
        }
        catch (err) {
            console.log(err);
            return 'An unexpected error occured, please try again!';
        }
        const response_text = await response.text();
        const response_lines = response_text.split('data:');
        let response_final = '', content;
        for (const line of response_lines) {
            try {
                content = JSON.parse(line)['choices'][0]['delta']['content'];
                if (content) response_final += content;
            }
            catch {
                continue;
            }
        }
        if (response_final.includes('Sorry, your request has been denied.')) {
            return await this.inference();
        }
        if (this.model_name == 'gpt-4' && response_final.startsWith('Answer: """')) {
            return response_final.slice('Answer: """'.length, -3);
        }
        return response_final;
    }

    activateMemoryManager() {
        this.memories = new Map();
        this.temp_mem_backup = new Map();
        this.activate_local_memories = new ActivateLocalMemories(this.memories);
        this.short_context_manager = new ShortContextManager(this.temp_mem_backup, this.q, this.a);
        this.local_mem_writer = new WriteNewLocalMemories(this.memories, this.temp_mem_backup, this.q, this.a);
    }

    async prompt(user_input) {
        let llm_output = '';
        if (this.activate_local_memories) {
            const backup = this.payloads.messages;
            this.payloads.messages = [
                {
                    "role": "system",
                    "content": "You're AI Assistant!"
                }
            ];
            const local_memories_activated = this.activate_local_memories.activateLocalMemories(user_input);
            const short_context_activated = this.short_context_manager.activateShortContextMem();

            for (const data of local_memories_activated) {
                const idx = data.indexOf(':');
                this.payloads.messages.push({ 'role': data.slice(0, idx), 'content': data.slice(idx + 1) });
            }
            for (const data of short_context_activated) {
                const idx = data.indexOf(':');
                this.payloads.messages.push({ 'role': data.slice(0, idx), 'content': data.slice(idx + 1) });
            }
            this.payloads.messages.push({ 'role': this.q, 'content': user_input });
            backup.push({ 'role': this.q, 'content': user_input });

            llm_output = await this.inference();

            backup.push({ 'role': this.a, 'content': llm_output });
            this.payloads.messages = backup;

            this.local_mem_writer.writeNewLocalMem(user_input, llm_output);
            this.short_context_manager.saveToShortContextMem(user_input, llm_output);
        }
        else {
            this.payloads.messages.push({ 'role': this.q, 'content': user_input });

            llm_output = await this.inference(user_input);

            this.payloads.messages.push({ 'role': this.a, 'content': llm_output });
        }
        return llm_output;
    }
}

class ActivateLocalMemories {
    constructor(memories, limit_mem_storage = 4) {
        this.memories = memories;
        this.limit_mem_storage = limit_mem_storage;
        this.nlp = new NLP();
    }

    activateLocalMemories(inp) {
        if (!this.memories.length) return [];

        const memories_act_scores = new Map();
        for (const mem of this.memories.keys()) {
            memories_act_scores.set(mem, this.nlp.similiary(inp, mem));
        }
        let most_mem_score = 0, most_mem = "", score;
        for (const mem of this.memories.keys()) {
            score = memories_act_scores.get(mem);
            if (score > most_mem_score) {
                most_mem_score = score;
                most_mem = mem;
            }
        }
        const most_memories = this.memories.get(most_mem);
        if (most_memories.length > this.limit_mem_storage * 2) {
            const randomPos = Math.round(Math.random() * (most_memories.length - this.limit_mem_storage * 2));
            return most_memories.slice(randomPos, randomPos + this.limit_mem_storage);
        }
        return most_memories;
    }
}

class WriteNewLocalMemories {
    constructor(memories, temp_mem_backup, q = "Human's say memories", a = "Bot's say memories", max_mem_context_towrite = 4) {
        this.memories = memories;
        this.temp_mem_backup = temp_mem_backup;
        this.max_mem_context_towrite = max_mem_context_towrite;
        this.q = q;
        this.a = a;
        this.nlp = new NLP();
        this.context = new Array();
    }

    writeMem(inp, ans, new_mem_name) {
        const memories_act_scores = new Map();
        for (const mem of this.memories.keys()) {
            memories_act_scores.set(mem, this.nlp.similiary(inp.replace(this.q, "").replace(this.a, "").split(' ').slice(0, 10), mem));
        }
        let most_mem_score = 0, most_mem = "", score;
        for (const mem of this.memories.keys()) {
            score = memories_act_scores.get(mem);
            if (score > most_mem_score) {
                most_mem_score = score;
                most_mem = mem;
            }
        }
        if (most_mem_score > 0.5) {
            this.memories.get(most_mem).push(inp, ans);
        }
        else {
            this.memories.set(new_mem_name, [inp, ans]);
        }
    }

    writeNewLocalMem(inp, ans) {
        this.context.push(this.q + ': ' + inp);
        this.context.push(this.a + ': ' + ans);

        if (this.context.length > this.max_mem_context_towrite) {
            let mem_name = this.nlp.removePunctuation(this.context[0].replace(this.q, "").replace(this.a, ""));
            mem_name = mem_name.split(' ').slice(0, 10);

            for (let i = 0; i < this.max_mem_context_towrite - 1; i += 2) {
                this.writeMem(this.context[i], this.context[i + 1], mem_name);
            }
            this.context = this.context.slice(this.context.length - this.max_mem_context_towrite);
        }
    }
}

class ShortContextManager {
    constructor(temp_mem_backup, q = "Human's context say", a = "Bot's context say", max_limit_short_mem_contxt = 4) {
        this.temp_mem_backup = temp_mem_backup;
        this.max_limit_short_mem_contxt = max_limit_short_mem_contxt;
        this.q = q;
        this.a = a;
        this.context = new Array();
    }

    saveToShortContextMem(inp, ans) {
        this.context.push(this.q + ': ' + inp);
        this.context.push(this.a + ': ' + ans);

        if (this.context.length > this.max_limit_short_mem_contxt) {
            this.context = this.context.slice(this.context.length - this.max_limit_short_mem_contxt);
        }
    }

    activateShortContextMem() {
        return this.context;
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
            chatbot.payloads.messages = messages;
            break;
        }
    }
}

function saveChatHistory(title) {
    const chatData = JSON.parse(localStorage.getItem('chatData'));
    for (const data of chatData) {
        if (data.title == title) {
            data.messages = chatbot.payloads.messages;
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

    let cnt = 0;
    for (const data of chatData) {
        cnt += (data.title == title);
    }
    if (cnt) title += ` (${cnt})`;
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
    btn.previousElementSibling.firstElementChild.addEventListener('focusout', (e) => {
        if (e.relatedTarget.className != 'option-btn') {
            cancelRename(e);
        }
    });
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

function displayContents(queue) {
    function displayContent(data) {
        resetDisplayProperty(data.curNode);
        data.curNode.setAttribute('class', 'cursor');
        let i = 0;
        const id = setInterval(() => {
            data.curNode.innerHTML += data.content[i++];
            messagesBox.scrollTop = messagesBox.scrollHeight;

            if (i == data.content.length) {
                data.curNode.removeAttribute('class');
                clearInterval(id);

                if (data.curNode.parentElement && data.curNode.parentElement.nodeName == 'PRE') {
                    hljs.highlightElement(data.curNode.parentElement);
                }

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

function getInnerTexts(queue, curNode) {
    function dfs(curNode) {
        for (const child of curNode.childNodes) {
            if (child.nodeType == 3) {
                const content = child.nodeValue;
                if (content == '\n') continue;
                child.nodeValue = '';
                queue.push({ 'curNode': curNode, 'content': content });
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
    chatbot.payloads['model'] = chatbot.model_name = e.target.value.toLowerCase();
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

                getInnerTexts(queue, output_model);
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
        chatbot.payloads.messages = [
            {
                "role": "system",
                "content": "You're AI Assistant!"
            }
        ];
    }
});

loadChatHistoryList();