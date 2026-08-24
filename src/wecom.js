/**
 * 企业微信推送封装
 *
 * 该项目使用企业微信【群机器人 Webhook】作为推送通道：
 *   - 只需要一个 webhook key（群机器人），无需 corpid / agentid / secret；
 *   - Worker 对每次收到的消息，POST 到企业微信群机器人接口即可推送到微信。
 *
 * key 从混淆的 secrets / 环境变量读取：
 *   - WECOM_WEBHOOK_KEY：?key= 后面的字符串
 *   - WECOM_WEBHOOK_URL：完整 webhook 地址（二选一，优先前者）
 */

const WECOM_WEBHOOK_BASE = 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send';

/** 文本消息单条内容上限（企业微信限制为 2048，这里做一次安全截断） */
const MAX_CONTENT_LENGTH = 4000;

/**
 * 拼接推送文本并发送到企业微信群机器人
 * @param {Env} env  Worker 绑定（读取 secrets）
 * @param {{title?: string, content: string}} msg
 * @returns {Promise<{ok: boolean, resp: any, errcode: number|null}>}
 */
export async function sendWechatWork(env, { title = '', content = '' }) {
  const key = (env.WECOM_WEBHOOK_KEY || '').trim();
  if (!key) {
    return {
      ok: false,
      resp: null,
      errcode: null,
      error: '未配置 WECOM_WEBHOOK_KEY，请先向 Worker 添加企业微信群机器人 webhook key 密钥。',
    };
  }

  const textContent = title
    ? `【${title}】\n${content}`.slice(0, MAX_CONTENT_LENGTH)
    : content.slice(0, MAX_CONTENT_LENGTH);

  let resp;
  try {
    const r = await fetch(`${WECOM_WEBHOOK_BASE}?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ msgtype: 'text', text: { content: textContent } }),
    });
    resp = await r.text();
  } catch (e) {
    return { ok: false, resp: null, errcode: null, error: `请求企业微信接口失败: ${e.message}` };
  }

  let parsed;
  try {
    parsed = JSON.parse(resp);
  } catch {
    parsed = { raw: resp };
  }

  // errcode === 0 表示推送成功
  return {
    ok: parsed.errcode === 0,
    resp: parsed,
    errcode: parsed.errcode ?? null,
    error: parsed.errcode === 0 ? null : `企业微信返回错误 errcode=${parsed.errcode} errmsg=${parsed.errmsg || resp}`,
  };
}