/** 控制面板入口：/admin → /admin.html（静态页） */
export default defineEventHandler((event) => {
  return sendRedirect(event, "/admin.html")
})
