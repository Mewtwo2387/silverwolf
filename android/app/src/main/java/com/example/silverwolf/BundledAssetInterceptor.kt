package com.example.silverwolf

import android.content.Context
import android.net.Uri
import android.webkit.WebResourceResponse

/**
 * Serves the heavy, rarely-changing static assets (fonts, SVG icons, sticker
 * and eidolon images) from the APK's bundled offline copy instead of the
 * network, so even a cold first load skips most of the payload. Hash-busted
 * assets (styles.css, app.js) are deliberately NOT intercepted — their content
 * changes on deploy and the HTTP cache already handles them.
 */
object BundledAssetInterceptor {
    // Site URL prefix -> bundled asset directory
    private val PATH_MAP = listOf(
        "/static/fonts/" to "offline/fonts/",
        "/static/svg/" to "offline/svg/",
        "/static/stickers/" to "offline/Images/",
        "/static/eidolons/" to "offline/Images/",
    )

    private val MIME_TYPES = mapOf(
        "woff2" to "font/woff2",
        "svg" to "image/svg+xml",
        "webp" to "image/webp",
        "avif" to "image/avif",
        "png" to "image/png",
    )

    fun intercept(context: Context, url: Uri): WebResourceResponse? {
        val path = url.path ?: return null
        val mapping = PATH_MAP.firstOrNull { path.startsWith(it.first) } ?: return null
        val fileName = path.removePrefix(mapping.first)
        // Asset names are flat — anything with a path separator is not ours
        if (fileName.isEmpty() || fileName.contains('/')) return null
        val mime = MIME_TYPES[fileName.substringAfterLast('.', "")] ?: return null

        return try {
            val stream = context.assets.open(mapping.second + fileName)
            WebResourceResponse(mime, null, stream)
        } catch (_: java.io.IOException) {
            null // not bundled — let it hit the network
        }
    }
}
