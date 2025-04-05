require('dotenv').config({path: '../.env'});

async function fetchChatCompletion() {
    const response = await fetch('https://api.aimlapi.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            "Authorization": "Bearer " + process.env.AIML_TOKEN,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            "model": "deepseek/deepseek-chat",
            "max_tokens": 512,
            "temperature": 1,
            "top_p": 1,
            "frequency_penalty": 1,
            "presence_penalty": 1,
            "messages": [
                {
                    "role": "system",
                    "content": "You are a helpful AI assistant."
                },
                {
                    "role": "user",
                    "content": "嗨，你好吗"
                }
            ],
            "stream": false
        })
    });

    const data = await response.json();
    console.log(JSON.stringify(data, null, 2)); // Pretty-print JSON
}

// Call the function
fetchChatCompletion();
