const Koa = require('koa')
const Router = require('@koa/router');
const axios = require('axios')
const logger = require('koa-logger')
const bodyParser = require('koa-bodyparser');
const xmlParser = require('koa-xml-body')
const crypto = require('crypto');

const app = new Koa();
const router = new Router();

app.use(logger())
app.use(xmlParser());
app.use(bodyParser());

const APP_ID = "wxe3e0e50059be6060";
const APP_SECRET = "cc21fe744662f2d40b8cd0e8e3b2a7cc";

router.get('/', async ctx => {

    let authCallbackUrl = 'http://zyp.sh1.k9s.run/auth-callback';
    let state = 'test1234';
    let scope = 'snsapi_userinfo';
    let authUrl = `https://open.weixin.qq.com/connect/oauth2/authorize?appid=${APP_ID}&redirect_uri=${authCallbackUrl}&response_type=code&scope=${scope}&state=${state}#wechat_redirect`
    ctx.redirect(authUrl);
});

router.get('/auth-callback', async ctx => {
    let {code, state} = ctx.query;
    // 判断state省略

    let tokenUrl = `https://api.weixin.qq.com/sns/oauth2/access_token?appid=${APP_ID}&secret=${APP_SECRET}&code=${code}&grant_type=authorization_code`;
    let access_token
    let open_id
    await axios.get(tokenUrl).then(async res => {
        let {refresh_token} = res.data
        let refreshTokenUrl = `https://api.weixin.qq.com/sns/oauth2/refresh_token?appid=${APP_ID}&grant_type=refresh_token&refresh_token=${refresh_token}`
        await axios.get(refreshTokenUrl).then(res => {
            access_token = res.data.access_token
            open_id = res.data.open_id
        })
    })
    let userInfoUrl = `https://api.weixin.qq.com/sns/userinfo?access_token=${access_token}&openid=${open_id}&lang=zh_CN`
    let res = await axios.get(userInfoUrl)//为什么不用模板
    ctx.body = `
    <div>
        <div><img src="${res.data.headimgurl}" alt="" style="width: 60px;height: 60px; border-radius: 50%"></div>
        <div><span>${res.data.nickname}</span></div>
        <div><span>${res.data.sex? (res.data.sex === 1? '男' : '女') : '未知'}</span></div>
        <div><span>${res.data.country}</span>-<span>${res.data.province}</span></div>
    </div>
    `
})

// 忘了怎么用的了

function checkSign(token, timestamp, nonce, signature) {
    let tmpArr = [token, timestamp, nonce];
    tmpArr.sort(); // 排序
    const tmpSign = crypto.createHash('sha1').update(tmpArr.join('')).digest('hex');
    // sha1
    return signature === tmpSign;
}

let msgToken = '123123123';
router.get('/wechat/msg', async ctx => {
    const {signature, timestamp, nonce, echostr} = ctx.query;
    if (checkSign(msgToken, timestamp, nonce, signature)) {
        ctx.body = echostr;
        return;
    }
    console.log('微信消息验证不通过');
});

function sendText(ctx, data) {
    const {toUser, fromUser, content} = data;
    ctx.body = `
    <xml>
  <ToUserName><![CDATA[${toUser}]]></ToUserName>
  <FromUserName><![CDATA[${fromUser}]]></FromUserName>
  <CreateTime>${Date.now()}</CreateTime>
  <MsgType><![CDATA[text]]></MsgType>
  <Content><![CDATA[${content}]]></Content>
</xml>
    `
}

async function getChatResponse(text, openid) {
    let url = `https://api.ownthink.com/bot`;
    console.log(text);
    let {data} = await axios.post(url, {
        appid: '4af16829983b40a2a8314d1e06257737',
        spoken: text,
        userid: openid,
    });
    return data.data.info.text;
}

router.post('/wechat/msg', async ctx => {
    const {signature, openid, timestamp} = ctx.query;
    const {ToUserName, FromUserName, CreateTime, MsgType, Content, MsgId} = ctx.request.body.xml;

    let chat = await getChatResponse(Content.toString(), openid);
    sendText(ctx, {
        toUser: FromUserName,
        fromUser: ToUserName,
        content: chat
    })
});


app.use(router.routes()).use(router.allowedMethods());

app.listen(80, function (err) {
    if (!err) {
        console.log('app started at ', 'http://127.0.0.1:80');
    }
});
