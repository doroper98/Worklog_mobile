/**
 * react-markdown's default urlTransform strips every scheme outside a
 * tiny safe list, including data: — which silently blanks the src on
 * pasted-image slates that store JPEGs as base64. Allow data:image/*
 * (and pass relative / http(s) URLs through untouched) while still
 * rejecting javascript: and friends.
 */
const SAFE_DATA_IMAGE = /^data:image\/(png|jpe?g|gif|webp|svg\+xml|avif|bmp);/i
const SAFE_SCHEME = /^(https?|mailto|tel|irc|ircs|xmpp|blob):/i

export function safeUrlTransform(url: string): string {
  if (!url) return ''
  if (SAFE_DATA_IMAGE.test(url)) return url
  // No scheme → relative or anchor; pass through
  if (!/^[a-z][a-z0-9+.-]*:/i.test(url)) return url
  if (SAFE_SCHEME.test(url)) return url
  return ''
}
