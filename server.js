import { connect } from 'puppeteer-real-browser';
import express from 'express';
import cors from 'cors';

const API = "https://free.netfly.top/api/openai/v1/chat/completions";
const PORT = 8080;
const app = express();

pageSetUp(API)
.then(({page, cookie}) => {
    app.use(cors());
    app.use(express.json());
    app.use(express.static('public'));

    app.post('/chat', async (req, res) => {
        const response_text = await page.evaluate(async (url, opt) => {
            const response = await fetch(url, opt);
            return await response.text();
        }, 
        API, 
        {
            method: 'POST', 
            headers: {
                ...req.headers,
                "cookie": cookie
            }, 
            body: JSON.stringify(req.body)
        });
        res.send(response_text);
    });

    app.listen(PORT, (error) => {
        if (!error) {
            console.log("Server is successfully running, and App is listening on port " + PORT);
        }
        else {
            console.log("Error occurred, server can't start", error);
        }
    });
})
.catch((err) => {
    console.log(err);
});

async function pageSetUp(url) {
    const { page } = await connect({
        fingerprint: true,
        turnstile: true,
        tf: true,
    });
    await page.goto(url, { waitUntil: "networkidle0" });
    await page.waitForNavigation();

    const cookies = await page.cookies();
    const cookieString = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');

    return {page: page, cookie: cookieString};
}