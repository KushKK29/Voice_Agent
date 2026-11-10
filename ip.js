// Client address for rate limits. Behind a reverse proxy (Render) every socket looks like the proxy, so read
// X-Forwarded-For, but only when TRUST_PROXY is set, and take the LAST entry: that one was appended by our own proxy.
export const clientIp = (req, trustProxy) => {
  const last = trustProxy && String(req.headers['x-forwarded-for'] ?? '').split(',').at(-1).trim();
  return last || req.socket.remoteAddress;
};
