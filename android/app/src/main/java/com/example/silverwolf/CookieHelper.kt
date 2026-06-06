package com.example.silverwolf

import android.webkit.CookieManager

object CookieHelper {
    fun setSessionCookie(url: String, signedSessionId: String) {
        val cookieManager = CookieManager.getInstance()
        cookieManager.setAcceptCookie(true)
        
        // Match the cookie options used on Hono server (Path=/, Lax, no-secure for dev HTTP)
        val cookieValue = "sw_session=$signedSessionId; Path=/; Max-Age=2592000; SameSite=Lax"
        cookieManager.setCookie(url, cookieValue)
        cookieManager.flush()
    }

    fun clearSessionCookie(url: String) {
        val cookieManager = CookieManager.getInstance()
        cookieManager.setCookie(url, "sw_session=; Path=/; Max-Age=0")
        cookieManager.flush()
    }
}
