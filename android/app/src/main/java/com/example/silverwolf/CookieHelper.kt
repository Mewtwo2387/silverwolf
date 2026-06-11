package com.example.silverwolf

import android.webkit.CookieManager

object CookieHelper {
    // The server names the cookie __Host-sw_session in production (HTTPS) and
    // sw_session in dev (HTTP). __Host- cookies must carry Secure or the
    // CookieManager rejects them, so the flags depend on the scheme.
    private fun cookieName(url: String) =
        if (url.startsWith("https://")) "__Host-sw_session" else "sw_session"

    fun setSessionCookie(url: String, signedSessionId: String) {
        val cookieManager = CookieManager.getInstance()
        cookieManager.setAcceptCookie(true)

        val secure = if (url.startsWith("https://")) "; Secure" else ""
        val cookieValue = "${cookieName(url)}=$signedSessionId; Path=/; Max-Age=2592000; SameSite=Lax$secure"
        cookieManager.setCookie(url, cookieValue)
        cookieManager.flush()
    }

    fun clearSessionCookie(url: String) {
        val cookieManager = CookieManager.getInstance()
        val secure = if (url.startsWith("https://")) "; Secure" else ""
        cookieManager.setCookie(url, "${cookieName(url)}=; Path=/; Max-Age=0$secure")
        cookieManager.flush()
    }
}
