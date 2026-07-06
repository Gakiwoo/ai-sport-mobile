const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'services', 'AuthService.ts');
let c = fs.readFileSync(filePath, 'utf8');

// 1. AuthFetch: delegate to authFetchWithTokens
c = c.replace(
  `async function authFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const tokens = await getStoredTokens();

  const headers`,
  `async function authFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const tokens = await getStoredTokens();
  return authFetchWithTokens(path, options, tokens);
}

/** 带显式 tokens 的 fetch。重试时直接用内存对象，不依赖存储可见性。 */
async function authFetchWithTokens(
  path: string,
  options: RequestInit = {},
  tokens: AuthTokens | null,
): Promise<Response> {
  const headers`
);

// 2. refreshToken: return AuthTokens | null instead of boolean
// Already done via earlier script — verify
if (c.includes('return false;')) {
  c = c.replace(
    `return false;
    }

    // 从响应头提取`,
    `return null;
    }

    // 从响应头提取`
  );
}

if (c.includes('return true;')) {
  c = c.replace(
    `return true;
  } catch {
    return false;`,
    `return tokens;
  } catch {
    return null;`
  );
}

// 3. fix: store tokens in variable before returning
if (c.includes('await storeTokens({ accessToken: newAccessToken, refreshToken: newRefreshToken });')) {
  c = c.replace(
    `    if (newAccessToken && newRefreshToken) {
      await storeTokens({ accessToken: newAccessToken, refreshToken: newRefreshToken });
    }`,
    `    const tokens = newAccessToken && newRefreshToken
      ? { accessToken: newAccessToken, refreshToken: newRefreshToken }
      : null;
    if (tokens) {
      await storeTokens(tokens);
    }`
  );
}

fs.writeFileSync(filePath, c);
console.log('AuthService.ts patched successfully');
