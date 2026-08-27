var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// node_modules/hono/dist/compose.js
var compose = /* @__PURE__ */ __name((middleware, onError, onNotFound) => {
  return (context, next) => {
    let index = -1;
    return dispatch(0);
    async function dispatch(i) {
      if (i <= index) {
        throw new Error("next() called multiple times");
      }
      index = i;
      let res;
      let isError = false;
      let handler;
      if (middleware[i]) {
        handler = middleware[i][0][0];
        context.req.routeIndex = i;
      } else {
        handler = i === middleware.length && next || void 0;
      }
      if (handler) {
        try {
          res = await handler(context, () => dispatch(i + 1));
        } catch (err) {
          if (err instanceof Error && onError) {
            context.error = err;
            res = await onError(err, context);
            isError = true;
          } else {
            throw err;
          }
        }
      } else {
        if (context.finalized === false && onNotFound) {
          res = await onNotFound(context);
        }
      }
      if (res && (context.finalized === false || isError)) {
        context.res = res;
      }
      return context;
    }
    __name(dispatch, "dispatch");
  };
}, "compose");

// node_modules/hono/dist/request/constants.js
var GET_MATCH_RESULT = /* @__PURE__ */ Symbol();

// node_modules/hono/dist/utils/buffer.js
var bufferToFormData = /* @__PURE__ */ __name((arrayBuffer, contentType) => {
  const response = new Response(arrayBuffer, {
    headers: {
      // Normalize the media type (case-insensitive) while keeping parameters like the boundary
      "Content-Type": contentType.replace(/^[^;]+/, (mediaType) => mediaType.toLowerCase())
    }
  });
  return response.formData();
}, "bufferToFormData");

// node_modules/hono/dist/utils/body.js
var isRawRequest = /* @__PURE__ */ __name((request) => "headers" in request, "isRawRequest");
var parseBody = /* @__PURE__ */ __name(async (request, options = /* @__PURE__ */ Object.create(null)) => {
  const { all = false, dot = false } = options;
  const headers = isRawRequest(request) ? request.headers : request.raw.headers;
  const contentType = headers.get("Content-Type");
  const mediaType = contentType?.split(";")[0].trim().toLowerCase();
  if (mediaType === "multipart/form-data" || mediaType === "application/x-www-form-urlencoded") {
    return parseFormData(request, { all, dot });
  }
  return {};
}, "parseBody");
async function parseFormData(request, options) {
  if (!isRawRequest(request) && request.bodyCache.formData) {
    return convertFormDataToBodyData(
      await request.bodyCache.formData,
      options
    );
  }
  const headers = isRawRequest(request) ? request.headers : request.raw.headers;
  const arrayBuffer = await request.arrayBuffer();
  const formDataPromise = bufferToFormData(arrayBuffer, headers.get("Content-Type") || "");
  if (!isRawRequest(request)) {
    request.bodyCache.formData = formDataPromise;
  }
  const formData = await formDataPromise;
  if (formData) {
    return convertFormDataToBodyData(formData, options);
  }
  return {};
}
__name(parseFormData, "parseFormData");
function convertFormDataToBodyData(formData, options) {
  const form = /* @__PURE__ */ Object.create(null);
  formData.forEach((value, key) => {
    const shouldParseAllValues = options.all || key.endsWith("[]");
    if (!shouldParseAllValues) {
      form[key] = value;
    } else {
      handleParsingAllValues(form, key, value);
    }
  });
  if (options.dot) {
    Object.entries(form).forEach(([key, value]) => {
      const shouldParseDotValues = key.includes(".");
      if (shouldParseDotValues) {
        handleParsingNestedValues(form, key, value);
        delete form[key];
      }
    });
  }
  return form;
}
__name(convertFormDataToBodyData, "convertFormDataToBodyData");
var handleParsingAllValues = /* @__PURE__ */ __name((form, key, value) => {
  if (form[key] !== void 0) {
    if (Array.isArray(form[key])) {
      ;
      form[key].push(value);
    } else {
      form[key] = [form[key], value];
    }
  } else {
    if (!key.endsWith("[]")) {
      form[key] = value;
    } else {
      form[key] = [value];
    }
  }
}, "handleParsingAllValues");
var handleParsingNestedValues = /* @__PURE__ */ __name((form, key, value) => {
  if (/(?:^|\.)__proto__\./.test(key)) {
    return;
  }
  let nestedForm = form;
  const keys = key.split(".");
  keys.forEach((key2, index) => {
    if (index === keys.length - 1) {
      nestedForm[key2] = value;
    } else {
      if (!nestedForm[key2] || typeof nestedForm[key2] !== "object" || Array.isArray(nestedForm[key2]) || nestedForm[key2] instanceof File) {
        nestedForm[key2] = /* @__PURE__ */ Object.create(null);
      }
      nestedForm = nestedForm[key2];
    }
  });
}, "handleParsingNestedValues");

// node_modules/hono/dist/utils/url.js
var splitPath = /* @__PURE__ */ __name((path) => {
  const paths = path.split("/");
  if (paths[0] === "") {
    paths.shift();
  }
  return paths;
}, "splitPath");
var splitRoutingPath = /* @__PURE__ */ __name((routePath) => {
  const { groups, path } = extractGroupsFromPath(routePath);
  const paths = splitPath(path);
  return replaceGroupMarks(paths, groups);
}, "splitRoutingPath");
var extractGroupsFromPath = /* @__PURE__ */ __name((path) => {
  const groups = [];
  path = path.replace(/\{[^}]+\}/g, (match2, index) => {
    const mark = `@${index}`;
    groups.push([mark, match2]);
    return mark;
  });
  return { groups, path };
}, "extractGroupsFromPath");
var replaceGroupMarks = /* @__PURE__ */ __name((paths, groups) => {
  for (let i = groups.length - 1; i >= 0; i--) {
    const [mark] = groups[i];
    for (let j = paths.length - 1; j >= 0; j--) {
      if (paths[j].includes(mark)) {
        paths[j] = paths[j].replace(mark, groups[i][1]);
        break;
      }
    }
  }
  return paths;
}, "replaceGroupMarks");
var patternCache = {};
var getPattern = /* @__PURE__ */ __name((label, next) => {
  if (label === "*") {
    return "*";
  }
  const match2 = label.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
  if (match2) {
    const cacheKey = `${label}#${next}`;
    if (!patternCache[cacheKey]) {
      if (match2[2]) {
        patternCache[cacheKey] = next && next[0] !== ":" && next[0] !== "*" ? [cacheKey, match2[1], new RegExp(`^${match2[2]}(?=/${next})`)] : [label, match2[1], new RegExp(`^${match2[2]}$`)];
      } else {
        patternCache[cacheKey] = [label, match2[1], true];
      }
    }
    return patternCache[cacheKey];
  }
  return null;
}, "getPattern");
var tryDecode = /* @__PURE__ */ __name((str, decoder) => {
  try {
    return decoder(str);
  } catch {
    return str.replace(/(?:%[0-9A-Fa-f]{2})+/g, (match2) => {
      try {
        return decoder(match2);
      } catch {
        return match2;
      }
    });
  }
}, "tryDecode");
var tryDecodeURI = /* @__PURE__ */ __name((str) => tryDecode(str, decodeURI), "tryDecodeURI");
var getPath = /* @__PURE__ */ __name((request) => {
  const url = request.url;
  const start = url.indexOf("/", url.indexOf(":") + 4);
  let i = start;
  for (; i < url.length; i++) {
    const charCode = url.charCodeAt(i);
    if (charCode === 37) {
      const queryIndex = url.indexOf("?", i);
      const hashIndex = url.indexOf("#", i);
      const end = queryIndex === -1 ? hashIndex === -1 ? void 0 : hashIndex : hashIndex === -1 ? queryIndex : Math.min(queryIndex, hashIndex);
      const path = url.slice(start, end);
      return tryDecodeURI(path.includes("%25") ? path.replace(/%25/g, "%2525") : path);
    } else if (charCode === 63 || charCode === 35) {
      break;
    }
  }
  return url.slice(start, i);
}, "getPath");
var getPathNoStrict = /* @__PURE__ */ __name((request) => {
  const result = getPath(request);
  return result.length > 1 && result.at(-1) === "/" ? result.slice(0, -1) : result;
}, "getPathNoStrict");
var mergePath = /* @__PURE__ */ __name((base, sub, ...rest) => {
  if (rest.length) {
    sub = mergePath(sub, ...rest);
  }
  return `${base?.[0] === "/" ? "" : "/"}${base}${sub === "/" ? "" : `${base?.at(-1) === "/" ? "" : "/"}${sub?.[0] === "/" ? sub.slice(1) : sub}`}`;
}, "mergePath");
var checkOptionalParameter = /* @__PURE__ */ __name((path) => {
  if (path.charCodeAt(path.length - 1) !== 63 || !path.includes(":")) {
    return null;
  }
  const segments = path.split("/");
  const results = [];
  let basePath = "";
  segments.forEach((segment) => {
    if (segment !== "" && !/\:/.test(segment)) {
      basePath += "/" + segment;
    } else if (/\:/.test(segment)) {
      if (segment.charCodeAt(segment.length - 1) === 63) {
        if (results.length === 0 && basePath === "") {
          results.push("/");
        } else {
          results.push(basePath);
        }
        const optionalSegment = segment.slice(0, -1);
        basePath += "/" + optionalSegment;
        results.push(basePath);
      } else {
        basePath += "/" + segment;
      }
    }
  });
  return results.filter((v, i, a) => a.indexOf(v) === i);
}, "checkOptionalParameter");
var tryDecodeURIComponent = /* @__PURE__ */ __name((str) => str.indexOf("%") !== -1 ? tryDecode(str, decodeURIComponent_) : str, "tryDecodeURIComponent");
var _decodeURI = /* @__PURE__ */ __name((value) => {
  if (value.indexOf("+") !== -1) {
    value = value.replace(/\+/g, " ");
  }
  return tryDecodeURIComponent(value);
}, "_decodeURI");
var _getQueryParam = /* @__PURE__ */ __name((url, key, multiple) => {
  let encoded;
  if (!multiple && key && key.indexOf("%") === -1 && key.indexOf("+") === -1) {
    let keyIndex2 = url.indexOf("?", 8);
    if (keyIndex2 === -1) {
      return void 0;
    }
    if (!url.startsWith(key, keyIndex2 + 1)) {
      keyIndex2 = url.indexOf(`&${key}`, keyIndex2 + 1);
    }
    while (keyIndex2 !== -1) {
      const trailingKeyCode = url.charCodeAt(keyIndex2 + key.length + 1);
      if (trailingKeyCode === 61) {
        const valueIndex = keyIndex2 + key.length + 2;
        const endIndex = url.indexOf("&", valueIndex);
        return _decodeURI(url.slice(valueIndex, endIndex === -1 ? void 0 : endIndex));
      } else if (trailingKeyCode == 38 || isNaN(trailingKeyCode)) {
        return "";
      }
      keyIndex2 = url.indexOf(`&${key}`, keyIndex2 + 1);
    }
    encoded = /[%+]/.test(url);
    if (!encoded) {
      return void 0;
    }
  }
  const results = /* @__PURE__ */ Object.create(null);
  encoded ??= /[%+]/.test(url);
  let keyIndex = url.indexOf("?", 8);
  while (keyIndex !== -1) {
    const nextKeyIndex = url.indexOf("&", keyIndex + 1);
    let valueIndex = url.indexOf("=", keyIndex);
    if (valueIndex > nextKeyIndex && nextKeyIndex !== -1) {
      valueIndex = -1;
    }
    let name = url.slice(
      keyIndex + 1,
      valueIndex === -1 ? nextKeyIndex === -1 ? void 0 : nextKeyIndex : valueIndex
    );
    if (encoded) {
      name = _decodeURI(name);
    }
    keyIndex = nextKeyIndex;
    if (name === "") {
      continue;
    }
    let value;
    if (valueIndex === -1) {
      value = "";
    } else {
      value = url.slice(valueIndex + 1, nextKeyIndex === -1 ? void 0 : nextKeyIndex);
      if (encoded) {
        value = _decodeURI(value);
      }
    }
    if (multiple) {
      if (!(results[name] && Array.isArray(results[name]))) {
        results[name] = [];
      }
      ;
      results[name].push(value);
    } else {
      results[name] ??= value;
    }
  }
  return key ? results[key] : results;
}, "_getQueryParam");
var getQueryParam = _getQueryParam;
var getQueryParams = /* @__PURE__ */ __name((url, key) => {
  return _getQueryParam(url, key, true);
}, "getQueryParams");
var decodeURIComponent_ = decodeURIComponent;

// node_modules/hono/dist/request.js
var HonoRequest = class {
  static {
    __name(this, "HonoRequest");
  }
  /**
   * `.raw` can get the raw Request object.
   *
   * @see {@link https://hono.dev/docs/api/request#raw}
   *
   * @example
   * ```ts
   * // For Cloudflare Workers
   * app.post('/', async (c) => {
   *   const metadata = c.req.raw.cf?.hostMetadata?
   *   ...
   * })
   * ```
   */
  raw;
  #validatedData;
  // Short name of validatedData
  #matchResult;
  routeIndex = 0;
  /**
   * `.path` can get the pathname of the request.
   *
   * @see {@link https://hono.dev/docs/api/request#path}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const pathname = c.req.path // `/about/me`
   * })
   * ```
   */
  path;
  bodyCache = {};
  constructor(request, path = "/", matchResult = [[]]) {
    this.raw = request;
    this.path = path;
    this.#matchResult = matchResult;
  }
  param(key) {
    return key ? this.#getDecodedParam(key) : this.#getAllDecodedParams();
  }
  #getDecodedParam(key) {
    const paramKey = this.#matchResult[0][this.routeIndex][1][key];
    const param = this.#getParamValue(paramKey);
    return param && tryDecodeURIComponent(param);
  }
  #getAllDecodedParams() {
    const decoded = {};
    const keys = Object.keys(this.#matchResult[0][this.routeIndex][1]);
    for (const key of keys) {
      const value = this.#getParamValue(this.#matchResult[0][this.routeIndex][1][key]);
      if (value !== void 0) {
        decoded[key] = tryDecodeURIComponent(value);
      }
    }
    return decoded;
  }
  #getParamValue(paramKey) {
    return this.#matchResult[1] ? this.#matchResult[1][paramKey] : paramKey;
  }
  query(key) {
    return getQueryParam(this.url, key);
  }
  queries(key) {
    return getQueryParams(this.url, key);
  }
  header(name) {
    if (name) {
      return this.raw.headers.get(name) ?? void 0;
    }
    const headerData = /* @__PURE__ */ Object.create(null);
    this.raw.headers.forEach((value, key) => {
      headerData[key] = value;
    });
    return headerData;
  }
  async parseBody(options) {
    return parseBody(this, options);
  }
  #cachedBody = /* @__PURE__ */ __name((key) => {
    const { bodyCache, raw: raw2 } = this;
    const cachedBody = bodyCache[key];
    if (cachedBody) {
      return cachedBody;
    }
    for (const anyCachedKey in bodyCache) {
      return bodyCache[anyCachedKey].then((body) => {
        if (anyCachedKey === "json") {
          body = JSON.stringify(body);
        }
        return new Response(body)[key]();
      });
    }
    return bodyCache[key] = raw2[key]();
  }, "#cachedBody");
  /**
   * `.json()` can parse Request body of type `application/json`
   *
   * @see {@link https://hono.dev/docs/api/request#json}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.json()
   * })
   * ```
   */
  json() {
    return this.#cachedBody("text").then((text) => JSON.parse(text));
  }
  /**
   * `.text()` can parse Request body of type `text/plain`
   *
   * @see {@link https://hono.dev/docs/api/request#text}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.text()
   * })
   * ```
   */
  text() {
    return this.#cachedBody("text");
  }
  /**
   * `.arrayBuffer()` parse Request body as an `ArrayBuffer`
   *
   * @see {@link https://hono.dev/docs/api/request#arraybuffer}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.arrayBuffer()
   * })
   * ```
   */
  arrayBuffer() {
    return this.#cachedBody("arrayBuffer");
  }
  /**
   * `.bytes()` parses the request body as a `Uint8Array`.
   *
   * @see {@link https://hono.dev/docs/api/request#bytes}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.bytes()
   * })
   * ```
   */
  bytes() {
    return this.#cachedBody("arrayBuffer").then((buffer) => new Uint8Array(buffer));
  }
  /**
   * Parses the request body as a `Blob`.
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.blob();
   * });
   * ```
   * @see https://hono.dev/docs/api/request#blob
   */
  blob() {
    return this.#cachedBody("blob");
  }
  /**
   * Parses the request body as `FormData`.
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.formData();
   * });
   * ```
   * @see https://hono.dev/docs/api/request#formdata
   */
  formData() {
    return this.#cachedBody("formData");
  }
  /**
   * Adds validated data to the request.
   *
   * @param target - The target of the validation.
   * @param data - The validated data to add.
   */
  addValidatedData(target, data) {
    ;
    (this.#validatedData ??= {})[target] = data;
  }
  valid(target) {
    return this.#validatedData?.[target];
  }
  /**
   * `.url()` can get the request url strings.
   *
   * @see {@link https://hono.dev/docs/api/request#url}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const url = c.req.url // `http://localhost:8787/about/me`
   *   ...
   * })
   * ```
   */
  get url() {
    return this.raw.url;
  }
  /**
   * `.method()` can get the method name of the request.
   *
   * @see {@link https://hono.dev/docs/api/request#method}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const method = c.req.method // `GET`
   * })
   * ```
   */
  get method() {
    return this.raw.method;
  }
  get [GET_MATCH_RESULT]() {
    return this.#matchResult;
  }
  /**
   * `.matchedRoutes()` can return a matched route in the handler
   *
   * @deprecated
   *
   * Use matchedRoutes helper defined in "hono/route" instead.
   *
   * @see {@link https://hono.dev/docs/api/request#matchedroutes}
   *
   * @example
   * ```ts
   * app.use('*', async function logger(c, next) {
   *   await next()
   *   c.req.matchedRoutes.forEach(({ handler, method, path }, i) => {
   *     const name = handler.name || (handler.length < 2 ? '[handler]' : '[middleware]')
   *     console.log(
   *       method,
   *       ' ',
   *       path,
   *       ' '.repeat(Math.max(10 - path.length, 0)),
   *       name,
   *       i === c.req.routeIndex ? '<- respond from here' : ''
   *     )
   *   })
   * })
   * ```
   */
  get matchedRoutes() {
    return this.#matchResult[0].map(([[, route2]]) => route2);
  }
  /**
   * `routePath()` can retrieve the path registered within the handler
   *
   * @deprecated
   *
   * Use routePath helper defined in "hono/route" instead.
   *
   * @see {@link https://hono.dev/docs/api/request#routepath}
   *
   * @example
   * ```ts
   * app.get('/posts/:id', (c) => {
   *   return c.json({ path: c.req.routePath })
   * })
   * ```
   */
  get routePath() {
    return this.#matchResult[0].map(([[, route2]]) => route2)[this.routeIndex].path;
  }
};

// node_modules/hono/dist/utils/html.js
var HtmlEscapedCallbackPhase = {
  Stringify: 1,
  BeforeStream: 2,
  Stream: 3
};
var raw = /* @__PURE__ */ __name((value, callbacks) => {
  const escapedString = new String(value);
  escapedString.isEscaped = true;
  escapedString.callbacks = callbacks;
  return escapedString;
}, "raw");
var resolveCallback = /* @__PURE__ */ __name(async (str, phase, preserveCallbacks, context, buffer) => {
  if (typeof str === "object" && !(str instanceof String)) {
    if (!(str instanceof Promise)) {
      str = str.toString();
    }
    if (str instanceof Promise) {
      str = await str;
    }
  }
  const callbacks = str.callbacks;
  if (!callbacks?.length) {
    return Promise.resolve(str);
  }
  if (buffer) {
    buffer[0] += str;
  } else {
    buffer = [str];
  }
  const resStr = Promise.all(callbacks.map((c) => c({ phase, buffer, context }))).then(
    (res) => Promise.all(
      res.filter(Boolean).map((str2) => resolveCallback(str2, phase, false, context, buffer))
    ).then(() => buffer[0])
  );
  if (preserveCallbacks) {
    return raw(await resStr, callbacks);
  } else {
    return resStr;
  }
}, "resolveCallback");

// node_modules/hono/dist/context.js
var TEXT_PLAIN = "text/plain; charset=UTF-8";
var setDefaultContentType = /* @__PURE__ */ __name((contentType, headers) => {
  return {
    "Content-Type": contentType,
    ...headers
  };
}, "setDefaultContentType");
var createResponseInstance = /* @__PURE__ */ __name((body, init) => new Response(body, init), "createResponseInstance");
var Context = class {
  static {
    __name(this, "Context");
  }
  #rawRequest;
  #req;
  /**
   * `.env` can get bindings (environment variables, secrets, KV namespaces, D1 database, R2 bucket etc.) in Cloudflare Workers.
   *
   * @see {@link https://hono.dev/docs/api/context#env}
   *
   * @example
   * ```ts
   * // Environment object for Cloudflare Workers
   * app.get('*', async c => {
   *   const counter = c.env.COUNTER
   * })
   * ```
   */
  env = {};
  #var;
  finalized = false;
  /**
   * `.error` can get the error object from the middleware if the Handler throws an error.
   *
   * @see {@link https://hono.dev/docs/api/context#error}
   *
   * @example
   * ```ts
   * app.use('*', async (c, next) => {
   *   await next()
   *   if (c.error) {
   *     // do something...
   *   }
   * })
   * ```
   */
  error;
  #status;
  #executionCtx;
  #res;
  #layout;
  #renderer;
  #notFoundHandler;
  #preparedHeaders;
  #matchResult;
  #path;
  /**
   * Creates an instance of the Context class.
   *
   * @param req - The Request object.
   * @param options - Optional configuration options for the context.
   */
  constructor(req, options) {
    this.#rawRequest = req;
    if (options) {
      this.#executionCtx = options.executionCtx;
      this.env = options.env;
      this.#notFoundHandler = options.notFoundHandler;
      this.#path = options.path;
      this.#matchResult = options.matchResult;
    }
  }
  /**
   * `.req` is the instance of {@link HonoRequest}.
   */
  get req() {
    this.#req ??= new HonoRequest(this.#rawRequest, this.#path, this.#matchResult);
    return this.#req;
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#event}
   * The FetchEvent associated with the current request.
   *
   * @throws Will throw an error if the context does not have a FetchEvent.
   */
  get event() {
    if (this.#executionCtx && "respondWith" in this.#executionCtx) {
      return this.#executionCtx;
    } else {
      throw Error("This context has no FetchEvent");
    }
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#executionctx}
   * The ExecutionContext associated with the current request.
   *
   * @throws Will throw an error if the context does not have an ExecutionContext.
   */
  get executionCtx() {
    if (this.#executionCtx) {
      return this.#executionCtx;
    } else {
      throw Error("This context has no ExecutionContext");
    }
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#res}
   * The Response object for the current request.
   */
  get res() {
    return this.#res ||= createResponseInstance(null, {
      headers: this.#preparedHeaders ??= new Headers()
    });
  }
  /**
   * Sets the Response object for the current request.
   *
   * @param _res - The Response object to set.
   */
  set res(_res) {
    if (this.#res && _res) {
      _res = createResponseInstance(_res.body, _res);
      for (const [k, v] of this.#res.headers.entries()) {
        if (k === "content-type") {
          continue;
        }
        if (k === "set-cookie") {
          const cookies = this.#res.headers.getSetCookie();
          _res.headers.delete("set-cookie");
          for (const cookie of cookies) {
            _res.headers.append("set-cookie", cookie);
          }
        } else {
          _res.headers.set(k, v);
        }
      }
    }
    this.#res = _res;
    this.finalized = true;
  }
  /**
   * `.render()` can create a response within a layout.
   *
   * @see {@link https://hono.dev/docs/api/context#render-setrenderer}
   *
   * @example
   * ```ts
   * app.get('/', (c) => {
   *   return c.render('Hello!')
   * })
   * ```
   */
  render = /* @__PURE__ */ __name((...args) => {
    this.#renderer ??= (content) => this.html(content);
    return this.#renderer(...args);
  }, "render");
  /**
   * Sets the layout for the response.
   *
   * @param layout - The layout to set.
   * @returns The layout function.
   */
  setLayout = /* @__PURE__ */ __name((layout) => this.#layout = layout, "setLayout");
  /**
   * Gets the current layout for the response.
   *
   * @returns The current layout function.
   */
  getLayout = /* @__PURE__ */ __name(() => this.#layout, "getLayout");
  /**
   * `.setRenderer()` can set the layout in the custom middleware.
   *
   * @see {@link https://hono.dev/docs/api/context#render-setrenderer}
   *
   * @example
   * ```tsx
   * app.use('*', async (c, next) => {
   *   c.setRenderer((content) => {
   *     return c.html(
   *       <html>
   *         <body>
   *           <p>{content}</p>
   *         </body>
   *       </html>
   *     )
   *   })
   *   await next()
   * })
   * ```
   */
  setRenderer = /* @__PURE__ */ __name((renderer) => {
    this.#renderer = renderer;
  }, "setRenderer");
  /**
   * `.header()` can set headers.
   *
   * @see {@link https://hono.dev/docs/api/context#header}
   *
   * @example
   * ```ts
   * app.get('/welcome', (c) => {
   *   // Set headers
   *   c.header('X-Message', 'Hello!')
   *   c.header('Content-Type', 'text/plain')
   *
   *   return c.body('Thank you for coming')
   * })
   * ```
   */
  header = /* @__PURE__ */ __name((name, value, options) => {
    if (this.finalized) {
      this.#res = createResponseInstance(this.#res.body, this.#res);
    }
    const headers = this.#res ? this.#res.headers : this.#preparedHeaders ??= new Headers();
    if (value === void 0) {
      headers.delete(name);
    } else if (options?.append) {
      headers.append(name, value);
    } else {
      headers.set(name, value);
    }
  }, "header");
  status = /* @__PURE__ */ __name((status) => {
    this.#status = status;
  }, "status");
  /**
   * `.set()` can set the value specified by the key.
   *
   * @see {@link https://hono.dev/docs/api/context#set-get}
   *
   * @example
   * ```ts
   * app.use('*', async (c, next) => {
   *   c.set('message', 'Hono is hot!!')
   *   await next()
   * })
   * ```
   */
  set = /* @__PURE__ */ __name((key, value) => {
    this.#var ??= /* @__PURE__ */ new Map();
    this.#var.set(key, value);
  }, "set");
  /**
   * `.get()` can use the value specified by the key.
   *
   * @see {@link https://hono.dev/docs/api/context#set-get}
   *
   * @example
   * ```ts
   * app.get('/', (c) => {
   *   const message = c.get('message')
   *   return c.text(`The message is "${message}"`)
   * })
   * ```
   */
  get = /* @__PURE__ */ __name((key) => {
    return this.#var ? this.#var.get(key) : void 0;
  }, "get");
  /**
   * `.var` can access the value of a variable.
   *
   * @see {@link https://hono.dev/docs/api/context#var}
   *
   * @example
   * ```ts
   * const result = c.var.client.oneMethod()
   * ```
   */
  // c.var.propName is a read-only
  get var() {
    if (!this.#var) {
      return {};
    }
    return Object.fromEntries(this.#var);
  }
  #newResponse(data, arg, headers) {
    let responseHeaders = this.#res ? new Headers(this.#res.headers) : this.#preparedHeaders;
    if (typeof arg === "object" && arg.headers) {
      responseHeaders ??= new Headers();
      for (const [key, value] of new Headers(arg.headers)) {
        if (key === "set-cookie") {
          responseHeaders.append(key, value);
        } else {
          responseHeaders.set(key, value);
        }
      }
    }
    if (headers) {
      if (!responseHeaders) {
        let count = 0;
        for (const k in headers) {
          if (++count > 1 || typeof headers[k] !== "string") {
            responseHeaders = new Headers();
            break;
          }
        }
      }
      if (responseHeaders) {
        for (const k in headers) {
          const v = headers[k];
          if (typeof v === "string") {
            responseHeaders.set(k, v);
          } else {
            responseHeaders.delete(k);
            for (const v2 of v) {
              responseHeaders.append(k, v2);
            }
          }
        }
      }
    }
    const status = typeof arg === "number" ? arg : arg?.status ?? this.#status;
    return createResponseInstance(data, {
      status,
      headers: responseHeaders ?? headers
    });
  }
  newResponse = /* @__PURE__ */ __name((...args) => this.#newResponse(...args), "newResponse");
  /**
   * `.body()` can return the HTTP response.
   * You can set headers with `.header()` and set HTTP status code with `.status`.
   * This can also be set in `.text()`, `.json()` and so on.
   *
   * @see {@link https://hono.dev/docs/api/context#body}
   *
   * @example
   * ```ts
   * app.get('/welcome', (c) => {
   *   // Set headers
   *   c.header('X-Message', 'Hello!')
   *   c.header('Content-Type', 'text/plain')
   *   // Set HTTP status code
   *   c.status(201)
   *
   *   // Return the response body
   *   return c.body('Thank you for coming')
   * })
   * ```
   */
  body = /* @__PURE__ */ __name((data, arg, headers) => this.#newResponse(data, arg, headers), "body");
  /**
   * `.text()` can render text as `Content-Type:text/plain`.
   *
   * @see {@link https://hono.dev/docs/api/context#text}
   *
   * @example
   * ```ts
   * app.get('/say', (c) => {
   *   return c.text('Hello!')
   * })
   * ```
   */
  text = /* @__PURE__ */ __name((text, arg, headers) => {
    return !this.#preparedHeaders && !this.#status && !arg && !headers && !this.finalized ? new Response(text) : this.#newResponse(
      text,
      arg,
      setDefaultContentType(TEXT_PLAIN, headers)
    );
  }, "text");
  /**
   * `.json()` can render JSON as `Content-Type:application/json`.
   *
   * @see {@link https://hono.dev/docs/api/context#json}
   *
   * @example
   * ```ts
   * app.get('/api', (c) => {
   *   return c.json({ message: 'Hello!' })
   * })
   * ```
   */
  json = /* @__PURE__ */ __name((object, arg, headers) => {
    return this.#newResponse(
      JSON.stringify(object),
      arg,
      setDefaultContentType("application/json", headers)
    );
  }, "json");
  html = /* @__PURE__ */ __name((html, arg, headers) => {
    const res = /* @__PURE__ */ __name((html2) => this.#newResponse(html2, arg, setDefaultContentType("text/html; charset=UTF-8", headers)), "res");
    return typeof html === "object" ? resolveCallback(html, HtmlEscapedCallbackPhase.Stringify, false, {}).then(res) : res(html);
  }, "html");
  /**
   * `.redirect()` can Redirect, default status code is 302.
   *
   * @see {@link https://hono.dev/docs/api/context#redirect}
   *
   * @example
   * ```ts
   * app.get('/redirect', (c) => {
   *   return c.redirect('/')
   * })
   * app.get('/redirect-permanently', (c) => {
   *   return c.redirect('/', 301)
   * })
   * ```
   */
  redirect = /* @__PURE__ */ __name((location, status) => {
    const locationString = String(location);
    this.header(
      "Location",
      // Multibyes should be encoded
      // eslint-disable-next-line no-control-regex
      !/[^\x00-\xFF]/.test(locationString) ? locationString : encodeURI(locationString)
    );
    return this.newResponse(null, status ?? 302);
  }, "redirect");
  /**
   * `.notFound()` can return the Not Found Response.
   *
   * @see {@link https://hono.dev/docs/api/context#notfound}
   *
   * @example
   * ```ts
   * app.get('/notfound', (c) => {
   *   return c.notFound()
   * })
   * ```
   */
  notFound = /* @__PURE__ */ __name(() => {
    this.#notFoundHandler ??= () => createResponseInstance();
    return this.#notFoundHandler(this);
  }, "notFound");
};

// node_modules/hono/dist/router.js
var METHOD_NAME_ALL = "ALL";
var METHOD_NAME_ALL_LOWERCASE = "all";
var METHODS = ["get", "post", "put", "delete", "options", "patch", "query"];
var MESSAGE_MATCHER_IS_ALREADY_BUILT = "Can not add a route since the matcher is already built.";
var UnsupportedPathError = class extends Error {
  static {
    __name(this, "UnsupportedPathError");
  }
};

// node_modules/hono/dist/utils/constants.js
var COMPOSED_HANDLER = "__COMPOSED_HANDLER";

// node_modules/hono/dist/hono-base.js
var notFoundHandler = /* @__PURE__ */ __name((c) => {
  return c.text("404 Not Found", 404);
}, "notFoundHandler");
var errorHandler = /* @__PURE__ */ __name((err, c) => {
  if ("getResponse" in err) {
    const res = err.getResponse();
    return c.newResponse(res.body, res);
  }
  console.error(err);
  return c.text("Internal Server Error", 500);
}, "errorHandler");
var Hono = class _Hono {
  static {
    __name(this, "_Hono");
  }
  get;
  post;
  put;
  delete;
  options;
  patch;
  query;
  all;
  on;
  use;
  /*
    This class is like an abstract class and does not have a router.
    To use it, inherit the class and implement router in the constructor.
  */
  router;
  getPath;
  // Cannot use `#` because it requires visibility at JavaScript runtime.
  _basePath = "/";
  #path = "/";
  routes = [];
  constructor(options = {}) {
    const allMethods = [...METHODS, METHOD_NAME_ALL_LOWERCASE];
    allMethods.forEach((method) => {
      this[method] = (args1, ...args) => {
        if (typeof args1 === "string") {
          this.#path = args1;
        } else {
          this.#addRoute(method, this.#path, args1);
        }
        args.forEach((handler) => {
          this.#addRoute(method, this.#path, handler);
        });
        return this;
      };
    });
    this.on = (method, path, ...handlers) => {
      for (const p of [path].flat()) {
        this.#path = p;
        for (const m of [method].flat()) {
          handlers.map((handler) => {
            this.#addRoute(m.toUpperCase(), this.#path, handler);
          });
        }
      }
      return this;
    };
    this.use = (arg1, ...handlers) => {
      if (typeof arg1 === "string") {
        this.#path = arg1;
      } else {
        this.#path = "*";
        handlers.unshift(arg1);
      }
      handlers.forEach((handler) => {
        this.#addRoute(METHOD_NAME_ALL, this.#path, handler);
      });
      return this;
    };
    const { strict, ...optionsWithoutStrict } = options;
    Object.assign(this, optionsWithoutStrict);
    this.getPath = strict ?? true ? options.getPath ?? getPath : getPathNoStrict;
  }
  #clone() {
    const clone = new _Hono({
      router: this.router,
      getPath: this.getPath
    });
    clone.errorHandler = this.errorHandler;
    clone.#notFoundHandler = this.#notFoundHandler;
    clone.routes = this.routes;
    return clone;
  }
  #notFoundHandler = notFoundHandler;
  // Cannot use `#` because it requires visibility at JavaScript runtime.
  errorHandler = errorHandler;
  /**
   * `.route()` allows grouping other Hono instance in routes.
   *
   * @see {@link https://hono.dev/docs/api/routing#grouping}
   *
   * @param {string} path - base Path
   * @param {Hono} app - other Hono instance
   * @returns {Hono} routed Hono instance
   *
   * @example
   * ```ts
   * const app = new Hono()
   * const app2 = new Hono()
   *
   * app2.get("/user", (c) => c.text("user"))
   * app.route("/api", app2) // GET /api/user
   * ```
   */
  route(path, app2) {
    const subApp = this.basePath(path);
    app2.routes.map((r) => {
      let handler;
      if (app2.errorHandler === errorHandler) {
        handler = r.handler;
      } else {
        handler = /* @__PURE__ */ __name(async (c, next) => (await compose([], app2.errorHandler)(c, () => r.handler(c, next))).res, "handler");
        handler[COMPOSED_HANDLER] = r.handler;
      }
      subApp.#addRoute(r.method, r.path, handler, r.basePath);
    });
    return this;
  }
  /**
   * `.basePath()` allows base paths to be specified.
   *
   * @see {@link https://hono.dev/docs/api/routing#base-path}
   *
   * @param {string} path - base Path
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * const api = new Hono().basePath('/api')
   * ```
   */
  basePath(path) {
    const subApp = this.#clone();
    subApp._basePath = mergePath(this._basePath, path);
    return subApp;
  }
  /**
   * `.onError()` handles an error and returns a customized Response.
   *
   * @see {@link https://hono.dev/docs/api/hono#error-handling}
   *
   * @param {ErrorHandler} handler - request Handler for error
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * app.onError((err, c) => {
   *   console.error(`${err}`)
   *   return c.text('Custom Error Message', 500)
   * })
   * ```
   */
  onError = /* @__PURE__ */ __name((handler) => {
    this.errorHandler = handler;
    return this;
  }, "onError");
  /**
   * `.notFound()` allows you to customize a Not Found Response.
   *
   * @see {@link https://hono.dev/docs/api/hono#not-found}
   *
   * @param {NotFoundHandler} handler - request handler for not-found
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * app.notFound((c) => {
   *   return c.text('Custom 404 Message', 404)
   * })
   * ```
   */
  notFound = /* @__PURE__ */ __name((handler) => {
    this.#notFoundHandler = handler;
    return this;
  }, "notFound");
  /**
   * `.mount()` allows you to mount applications built with other frameworks into your Hono application.
   *
   * @see {@link https://hono.dev/docs/api/hono#mount}
   *
   * @param {string} path - base Path
   * @param {Function} applicationHandler - other Request Handler
   * @param {MountOptions} [options] - options of `.mount()`
   * @returns {Hono} mounted Hono instance
   *
   * @example
   * ```ts
   * import { Router as IttyRouter } from 'itty-router'
   * import { Hono } from 'hono'
   * // Create itty-router application
   * const ittyRouter = IttyRouter()
   * // GET /itty-router/hello
   * ittyRouter.get('/hello', () => new Response('Hello from itty-router'))
   *
   * const app = new Hono()
   * app.mount('/itty-router', ittyRouter.handle)
   * ```
   *
   * @example
   * ```ts
   * const app = new Hono()
   * // Send the request to another application without modification.
   * app.mount('/app', anotherApp, {
   *   replaceRequest: (req) => req,
   * })
   * ```
   */
  mount(path, applicationHandler, options) {
    let replaceRequest;
    let optionHandler;
    if (options) {
      if (typeof options === "function") {
        optionHandler = options;
      } else {
        optionHandler = options.optionHandler;
        if (options.replaceRequest === false) {
          replaceRequest = /* @__PURE__ */ __name((request) => request, "replaceRequest");
        } else {
          replaceRequest = options.replaceRequest;
        }
      }
    }
    const getOptions = optionHandler ? (c) => {
      const options2 = optionHandler(c);
      return Array.isArray(options2) ? options2 : [options2];
    } : (c) => {
      let executionContext = void 0;
      try {
        executionContext = c.executionCtx;
      } catch {
      }
      return [c.env, executionContext];
    };
    replaceRequest ||= (() => {
      const mergedPath = mergePath(this._basePath, path);
      const pathPrefixLength = mergedPath === "/" ? 0 : mergedPath.length;
      return (request) => {
        const url = new URL(request.url);
        url.pathname = this.getPath(request).slice(pathPrefixLength) || "/";
        return new Request(url, request);
      };
    })();
    const handler = /* @__PURE__ */ __name(async (c, next) => {
      const res = await applicationHandler(replaceRequest(c.req.raw), ...getOptions(c));
      if (res) {
        return res;
      }
      await next();
    }, "handler");
    this.#addRoute(METHOD_NAME_ALL, mergePath(path, "*"), handler);
    return this;
  }
  #addRoute(method, path, handler, baseRoutePath) {
    method = method.toUpperCase();
    path = mergePath(this._basePath, path);
    const r = {
      basePath: baseRoutePath !== void 0 ? mergePath(this._basePath, baseRoutePath) : this._basePath,
      path,
      method,
      handler
    };
    this.router.add(method, path, [handler, r]);
    this.routes.push(r);
  }
  #handleError(err, c) {
    if (err instanceof Error) {
      return this.errorHandler(err, c);
    }
    throw err;
  }
  #dispatch(request, executionCtx, env, method) {
    if (method === "HEAD") {
      return (async () => new Response(null, await this.#dispatch(request, executionCtx, env, "GET")))();
    }
    const path = this.getPath(request, { env });
    const matchResult = this.router.match(method, path);
    const c = new Context(request, {
      path,
      matchResult,
      env,
      executionCtx,
      notFoundHandler: this.#notFoundHandler
    });
    if (matchResult[0].length === 1) {
      let res;
      try {
        res = matchResult[0][0][0][0](c, async () => {
          c.res = await this.#notFoundHandler(c);
        });
      } catch (err) {
        return this.#handleError(err, c);
      }
      return res instanceof Promise ? res.then(
        (resolved) => resolved || (c.finalized ? c.res : this.#notFoundHandler(c))
      ).catch((err) => this.#handleError(err, c)) : res ?? this.#notFoundHandler(c);
    }
    const composed = compose(matchResult[0], this.errorHandler, this.#notFoundHandler);
    return (async () => {
      try {
        const context = await composed(c);
        if (!context.finalized) {
          throw new Error(
            "Context is not finalized. Did you forget to return a Response object or `await next()`?"
          );
        }
        return context.res;
      } catch (err) {
        return this.#handleError(err, c);
      }
    })();
  }
  /**
   * `.fetch()` will be entry point of your app.
   *
   * @see {@link https://hono.dev/docs/api/hono#fetch}
   *
   * @param {Request} request - request Object of request
   * @param {Env} env - env Object
   * @param {ExecutionContext} executionCtx - context of execution
   * @returns {Response | Promise<Response>} response of request
   *
   */
  fetch = /* @__PURE__ */ __name((request, ...rest) => {
    return this.#dispatch(request, rest[1], rest[0], request.method);
  }, "fetch");
  /**
   * `.request()` is a useful method for testing.
   * You can pass a URL or pathname to send a GET request.
   * app will return a Response object.
   * ```ts
   * test('GET /hello is ok', async () => {
   *   const res = await app.request('/hello')
   *   expect(res.status).toBe(200)
   * })
   * ```
   * @see https://hono.dev/docs/api/hono#request
   */
  request = /* @__PURE__ */ __name((input, requestInit, Env, executionCtx) => {
    if (input instanceof Request) {
      return this.fetch(requestInit ? new Request(input, requestInit) : input, Env, executionCtx);
    }
    input = input.toString();
    return this.fetch(
      new Request(
        /^https?:\/\//.test(input) ? input : `http://localhost${mergePath("/", input)}`,
        requestInit
      ),
      Env,
      executionCtx
    );
  }, "request");
  /**
   * `.fire()` automatically adds a global fetch event listener.
   * This can be useful for environments that adhere to the Service Worker API, such as non-ES module Cloudflare Workers.
   * @deprecated
   * Use `fire` from `hono/service-worker` instead.
   * ```ts
   * import { Hono } from 'hono'
   * import { fire } from 'hono/service-worker'
   *
   * const app = new Hono()
   * // ...
   * fire(app)
   * ```
   * @see https://hono.dev/docs/api/hono#fire
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API
   * @see https://developers.cloudflare.com/workers/reference/migrate-to-module-workers/
   */
  fire = /* @__PURE__ */ __name(() => {
    addEventListener("fetch", (event) => {
      event.respondWith(this.#dispatch(event.request, event, void 0, event.request.method));
    });
  }, "fire");
};

// node_modules/hono/dist/router/reg-exp-router/matcher.js
var emptyParam = [];
function match(method, path) {
  const matchers = this.buildAllMatchers();
  const match2 = /* @__PURE__ */ __name(((method2, path2) => {
    const matcher = matchers[method2] || matchers[METHOD_NAME_ALL];
    const staticMatch = matcher[2][path2];
    if (staticMatch) {
      return staticMatch;
    }
    const match3 = path2.match(matcher[0]);
    if (!match3) {
      return [[], emptyParam];
    }
    const index = match3.indexOf("", 1);
    return [matcher[1][index], match3];
  }), "match2");
  this.match = match2;
  return match2(method, path);
}
__name(match, "match");

// node_modules/hono/dist/router/reg-exp-router/node.js
var LABEL_REG_EXP_STR = "[^/]+";
var ONLY_WILDCARD_REG_EXP_STR = ".*";
var TAIL_WILDCARD_REG_EXP_STR = "(?:|/.*)";
var PATH_ERROR = /* @__PURE__ */ Symbol();
var regExpMetaChars = new Set(".\\+*[^]$()");
function compareKey(a, b) {
  if (a.length === 1) {
    return b.length === 1 ? a < b ? -1 : 1 : -1;
  }
  if (b.length === 1) {
    return 1;
  }
  if (a === ONLY_WILDCARD_REG_EXP_STR || a === TAIL_WILDCARD_REG_EXP_STR) {
    return b === TAIL_WILDCARD_REG_EXP_STR ? -1 : 1;
  } else if (b === ONLY_WILDCARD_REG_EXP_STR || b === TAIL_WILDCARD_REG_EXP_STR) {
    return -1;
  }
  if (a === LABEL_REG_EXP_STR) {
    return 1;
  } else if (b === LABEL_REG_EXP_STR) {
    return -1;
  }
  return a.length === b.length ? a < b ? -1 : 1 : b.length - a.length;
}
__name(compareKey, "compareKey");
var Node = class _Node {
  static {
    __name(this, "_Node");
  }
  // handler index of a dynamic path, or -1 for a static path terminal
  #index;
  #varIndex;
  #children = /* @__PURE__ */ Object.create(null);
  insert(tokens, index, paramMap, context, isStatic) {
    let node = this;
    for (let i = 0, len = tokens.length; i < len; i++) {
      const token = tokens[i];
      const pattern = token.length === 1 ? token === "*" ? i === len - 1 ? ["", "", ONLY_WILDCARD_REG_EXP_STR] : ["", "", LABEL_REG_EXP_STR] : null : token === "/*" ? ["", "", TAIL_WILDCARD_REG_EXP_STR] : token.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
      let nextNode;
      if (pattern) {
        const name = pattern[1];
        let regexpStr = pattern[2] || LABEL_REG_EXP_STR;
        if (name && pattern[2]) {
          if (regexpStr === ".*") {
            throw PATH_ERROR;
          }
          regexpStr = regexpStr.replace(/^\((?!\?:)(?=[^)]+\)$)/, "(?:");
          if (/\((?!\?:)/.test(regexpStr)) {
            throw PATH_ERROR;
          }
          if (regexpStr.length === 1 && regExpMetaChars.has(regexpStr)) {
            throw PATH_ERROR;
          }
        }
        nextNode = node.#children[regexpStr];
        if (!nextNode) {
          if (regexpStr !== ONLY_WILDCARD_REG_EXP_STR && regexpStr !== TAIL_WILDCARD_REG_EXP_STR) {
            for (const k in node.#children) {
              if (
                // a single-char pattern coexists with single-char literals as a literal does
                (regexpStr.length > 1 || k.length > 1) && k !== ONLY_WILDCARD_REG_EXP_STR && k !== TAIL_WILDCARD_REG_EXP_STR
              ) {
                throw PATH_ERROR;
              }
            }
          }
          nextNode = node.#children[regexpStr] = new _Node();
        }
        if (name !== "") {
          nextNode.#varIndex ??= context.varIndex++;
          paramMap.push([name, nextNode.#varIndex]);
        }
      } else {
        nextNode = node.#children[token];
        if (!nextNode) {
          for (const k in node.#children) {
            if (k.length > 1 && k !== ONLY_WILDCARD_REG_EXP_STR && k !== TAIL_WILDCARD_REG_EXP_STR) {
              throw PATH_ERROR;
            }
          }
          nextNode = node.#children[token] = new _Node();
        }
      }
      node = nextNode;
    }
    if (node.#index !== void 0) {
      throw PATH_ERROR;
    }
    node.#index = isStatic ? -1 : index;
  }
  buildRegExpStr() {
    const childKeys = Object.keys(this.#children).sort(compareKey);
    const strList = childKeys.map((k) => {
      const c = this.#children[k];
      const childStr = c.buildRegExpStr();
      return childStr === "" ? "" : (typeof c.#varIndex === "number" ? `(${k})@${c.#varIndex}` : regExpMetaChars.has(k) ? `\\${k}` : k) + childStr;
    }).filter(Boolean);
    if (typeof this.#index === "number" && this.#index !== -1) {
      strList.unshift(`#${this.#index}`);
    }
    if (strList.length === 0) {
      return "";
    }
    if (strList.length === 1) {
      return strList[0];
    }
    return "(?:" + strList.join("|") + ")";
  }
};

// node_modules/hono/dist/router/reg-exp-router/trie.js
var Trie = class {
  static {
    __name(this, "Trie");
  }
  #context = { varIndex: 0 };
  #root = new Node();
  #index = 0;
  // dynamic path -> [handler index, param assoc]; static paths are not registered
  paths = /* @__PURE__ */ Object.create(null);
  insert(path, isStatic) {
    if (isStatic) {
      this.#root.insert(path.split(""), 0, [], this.#context, true);
      return;
    }
    const paramAssoc = [];
    const groups = [];
    let markedPath = path;
    for (let i = 0; ; ) {
      let replaced = false;
      markedPath = markedPath.replace(/\{[^}]+\}/g, (m) => {
        const mark = `@\\${i}`;
        groups[i] = [mark, m];
        i++;
        replaced = true;
        return mark;
      });
      if (!replaced) {
        break;
      }
    }
    const tokens = markedPath.match(/(?::[^\/]+)|(?:\/\*$)|./g) || [];
    for (let i = groups.length - 1; i >= 0; i--) {
      const [mark] = groups[i];
      for (let j = tokens.length - 1; j >= 0; j--) {
        if (tokens[j].indexOf(mark) !== -1) {
          tokens[j] = tokens[j].replace(mark, groups[i][1]);
          break;
        }
      }
    }
    this.#root.insert(tokens, this.#index, paramAssoc, this.#context, false);
    this.paths[path] = [this.#index++, paramAssoc];
  }
  buildRegExp() {
    let regexp = this.#root.buildRegExpStr();
    if (regexp === "") {
      return [/^$/, [], []];
    }
    let captureIndex = 0;
    const indexReplacementMap = [];
    const paramReplacementMap = [];
    regexp = regexp.replace(/#(\d+)|@(\d+)|\.\*\$/g, (_, handlerIndex, paramIndex) => {
      if (handlerIndex !== void 0) {
        indexReplacementMap[++captureIndex] = Number(handlerIndex);
        return "$()";
      }
      if (paramIndex !== void 0) {
        paramReplacementMap[Number(paramIndex)] = ++captureIndex;
        return "";
      }
      return "";
    });
    return [new RegExp(`^${regexp}`), indexReplacementMap, paramReplacementMap];
  }
};

// node_modules/hono/dist/router/reg-exp-router/router.js
var wildcardRegExpCache = /* @__PURE__ */ Object.create(null);
function buildWildcardRegExp(path) {
  return wildcardRegExpCache[path] ??= new RegExp(
    path === "*" ? "" : `^${path.replace(
      /\/\*$|([.\\+*[^\]$()])/g,
      (_, metaChar) => metaChar ? `\\${metaChar}` : "(?:|/.*)"
    )}$`
  );
}
__name(buildWildcardRegExp, "buildWildcardRegExp");
function clearWildcardRegExpCache() {
  wildcardRegExpCache = /* @__PURE__ */ Object.create(null);
}
__name(clearWildcardRegExpCache, "clearWildcardRegExpCache");
function findMiddleware(middleware, path) {
  if (!middleware) {
    return void 0;
  }
  for (const k of Object.keys(middleware).sort((a, b) => b.length - a.length)) {
    if (buildWildcardRegExp(k).test(path)) {
      return [...middleware[k]];
    }
  }
  return void 0;
}
__name(findMiddleware, "findMiddleware");
var RegExpRouter = class {
  static {
    __name(this, "RegExpRouter");
  }
  name = "RegExpRouter";
  #middleware;
  #routes;
  #tries;
  constructor() {
    this.#middleware = { [METHOD_NAME_ALL]: /* @__PURE__ */ Object.create(null) };
    this.#routes = { [METHOD_NAME_ALL]: /* @__PURE__ */ Object.create(null) };
    this.#tries = { [METHOD_NAME_ALL]: new Trie() };
  }
  #insertPath(method, path) {
    try {
      this.#tries[method].insert(path, !/\*|\/:/.test(path));
    } catch (e) {
      throw e === PATH_ERROR ? new UnsupportedPathError(path) : e;
    }
  }
  add(method, path, handler) {
    const middleware = this.#middleware;
    const routes = this.#routes;
    if (!middleware || !routes) {
      throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    }
    if (!middleware[method]) {
      this.#tries[method] = new Trie();
      [middleware, routes].forEach((handlerMap) => {
        handlerMap[method] = /* @__PURE__ */ Object.create(null);
        Object.keys(handlerMap[METHOD_NAME_ALL]).forEach((p) => {
          handlerMap[method][p] = [...handlerMap[METHOD_NAME_ALL][p]];
          this.#insertPath(method, p);
        });
      });
    }
    if (path === "/*") {
      path = "*";
    }
    const paramCount = (path.match(/\/:/g) || []).length;
    if (/\*$/.test(path)) {
      const re = buildWildcardRegExp(path);
      Object.keys(middleware).forEach((m) => {
        if ((method === METHOD_NAME_ALL || method === m) && !middleware[m][path]) {
          this.#insertPath(m, path);
          middleware[m][path] = findMiddleware(middleware[m], path) || findMiddleware(middleware[METHOD_NAME_ALL], path) || [];
        }
      });
      Object.keys(middleware).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          Object.keys(middleware[m]).forEach((p) => {
            re.test(p) && middleware[m][p].push([handler, paramCount]);
          });
        }
      });
      Object.keys(routes).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          Object.keys(routes[m]).forEach(
            (p) => re.test(p) && routes[m][p].push([handler, paramCount])
          );
        }
      });
      return;
    }
    const paths = checkOptionalParameter(path) || [path];
    for (let i = 0, len = paths.length; i < len; i++) {
      const path2 = paths[i];
      Object.keys(routes).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          if (!routes[m][path2]) {
            this.#insertPath(m, path2);
            routes[m][path2] = [
              ...findMiddleware(middleware[m], path2) || findMiddleware(middleware[METHOD_NAME_ALL], path2) || []
            ];
          }
          routes[m][path2].push([handler, paramCount - len + i + 1]);
        }
      });
    }
  }
  match = match;
  buildAllMatchers() {
    const matchers = /* @__PURE__ */ Object.create(null);
    Object.keys(this.#routes).concat(Object.keys(this.#middleware)).forEach((method) => {
      matchers[method] ||= this.#buildMatcher(method);
    });
    this.#middleware = this.#routes = this.#tries = void 0;
    clearWildcardRegExpCache();
    return matchers;
  }
  #buildMatcher(method) {
    const middleware = this.#middleware[method];
    const routes = this.#routes[method];
    const trie = this.#tries[method];
    const staticMap = /* @__PURE__ */ Object.create(null);
    const handlerData = [];
    [middleware, routes].forEach((r) => {
      for (const path in r) {
        const handlers = r[path];
        const pathData = trie.paths[path];
        if (!pathData) {
          staticMap[path] = [handlers.map(([h]) => [h, /* @__PURE__ */ Object.create(null)]), emptyParam];
          continue;
        }
        const paramAssoc = pathData[1];
        handlerData[pathData[0]] = handlers.map(([h, paramCount]) => {
          const paramIndexMap = /* @__PURE__ */ Object.create(null);
          paramCount -= 1;
          for (; paramCount >= 0; paramCount--) {
            const [key, value] = paramAssoc[paramCount];
            paramIndexMap[key] = value;
          }
          return [h, paramIndexMap];
        });
      }
    });
    const [regexp, indexReplacementMap, paramReplacementMap] = trie.buildRegExp();
    for (let i = 0, len = handlerData.length; i < len; i++) {
      for (let j = 0, len2 = handlerData[i].length; j < len2; j++) {
        const map = handlerData[i][j]?.[1];
        if (!map) {
          continue;
        }
        const keys = Object.keys(map);
        for (let k = 0, len3 = keys.length; k < len3; k++) {
          map[keys[k]] = paramReplacementMap[map[keys[k]]];
        }
      }
    }
    const handlerMap = [];
    for (const i in indexReplacementMap) {
      handlerMap[i] = handlerData[indexReplacementMap[i]];
    }
    return [regexp, handlerMap, staticMap];
  }
};

// node_modules/hono/dist/router/smart-router/router.js
var SmartRouter = class {
  static {
    __name(this, "SmartRouter");
  }
  name = "SmartRouter";
  #routers = [];
  #routes = [];
  constructor(init) {
    this.#routers = init.routers;
  }
  add(method, path, handler) {
    if (!this.#routes) {
      throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    }
    this.#routes.push([method, path, handler]);
  }
  match(method, path) {
    if (!this.#routes) {
      throw new Error("Fatal error");
    }
    const routers = this.#routers;
    const routes = this.#routes;
    const len = routers.length;
    let i = 0;
    let res;
    for (; i < len; i++) {
      const router = routers[i];
      try {
        for (let i2 = 0, len2 = routes.length; i2 < len2; i2++) {
          router.add(...routes[i2]);
        }
        res = router.match(method, path);
      } catch (e) {
        if (e instanceof UnsupportedPathError) {
          continue;
        }
        throw e;
      }
      this.match = router.match.bind(router);
      this.#routers = [router];
      this.#routes = void 0;
      break;
    }
    if (i === len) {
      throw new Error("Fatal error");
    }
    this.name = `SmartRouter + ${this.activeRouter.name}`;
    return res;
  }
  get activeRouter() {
    if (this.#routes || this.#routers.length !== 1) {
      throw new Error("No active router has been determined yet.");
    }
    return this.#routers[0];
  }
};

// node_modules/hono/dist/router/trie-router/node.js
var emptyParams = /* @__PURE__ */ Object.create(null);
var hasChildren = /* @__PURE__ */ __name((children) => {
  for (const _ in children) {
    return true;
  }
  return false;
}, "hasChildren");
var Node2 = class _Node2 {
  static {
    __name(this, "_Node");
  }
  #methods;
  #children;
  #patterns;
  #order = 0;
  #params = emptyParams;
  constructor(method, handler, children) {
    this.#children = children || /* @__PURE__ */ Object.create(null);
    this.#methods = [];
    if (method && handler) {
      const m = /* @__PURE__ */ Object.create(null);
      m[method] = { handler, possibleKeys: [], score: 0 };
      this.#methods = [m];
    }
    this.#patterns = [];
  }
  insert(method, path, handler) {
    this.#order = ++this.#order;
    let curNode = this;
    const parts = splitRoutingPath(path);
    const possibleKeys = [];
    for (let i = 0, len = parts.length; i < len; i++) {
      const p = parts[i];
      const nextP = parts[i + 1];
      const pattern = getPattern(p, nextP);
      const key = Array.isArray(pattern) ? pattern[0] : p;
      if (key in curNode.#children) {
        curNode = curNode.#children[key];
        if (pattern) {
          possibleKeys.push(pattern[1]);
        }
        continue;
      }
      curNode.#children[key] = new _Node2();
      if (pattern) {
        curNode.#patterns.push(pattern);
        possibleKeys.push(pattern[1]);
      }
      curNode = curNode.#children[key];
    }
    curNode.#methods.push({
      [method]: {
        handler,
        possibleKeys: possibleKeys.filter((v, i, a) => a.indexOf(v) === i),
        score: this.#order
      }
    });
    return curNode;
  }
  #pushHandlerSets(handlerSets, node, method, nodeParams, params) {
    for (let i = 0, len = node.#methods.length; i < len; i++) {
      const m = node.#methods[i];
      const handlerSet = m[method] || m[METHOD_NAME_ALL];
      const processedSet = {};
      if (handlerSet !== void 0) {
        handlerSet.params = /* @__PURE__ */ Object.create(null);
        handlerSets.push(handlerSet);
        if (nodeParams !== emptyParams || params && params !== emptyParams) {
          for (let i2 = 0, len2 = handlerSet.possibleKeys.length; i2 < len2; i2++) {
            const key = handlerSet.possibleKeys[i2];
            const processed = processedSet[handlerSet.score];
            handlerSet.params[key] = params?.[key] && !processed ? params[key] : nodeParams[key] ?? params?.[key];
            processedSet[handlerSet.score] = true;
          }
        }
      }
    }
  }
  search(method, path) {
    const handlerSets = [];
    this.#params = emptyParams;
    const curNode = this;
    let curNodes = [curNode];
    const parts = splitPath(path);
    const curNodesQueue = [];
    const len = parts.length;
    let partOffsets = null;
    for (let i = 0; i < len; i++) {
      const part = parts[i];
      const isLast = i === len - 1;
      const tempNodes = [];
      for (let j = 0, len2 = curNodes.length; j < len2; j++) {
        const node = curNodes[j];
        const nextNode = node.#children[part];
        if (nextNode) {
          nextNode.#params = node.#params;
          if (isLast) {
            if (nextNode.#children["*"]) {
              this.#pushHandlerSets(handlerSets, nextNode.#children["*"], method, node.#params);
            }
            this.#pushHandlerSets(handlerSets, nextNode, method, node.#params);
          } else {
            tempNodes.push(nextNode);
          }
        }
        for (let k = 0, len3 = node.#patterns.length; k < len3; k++) {
          const pattern = node.#patterns[k];
          const params = node.#params === emptyParams ? {} : { ...node.#params };
          if (pattern === "*") {
            const astNode = node.#children["*"];
            if (astNode) {
              this.#pushHandlerSets(handlerSets, astNode, method, node.#params);
              astNode.#params = params;
              tempNodes.push(astNode);
            }
            continue;
          }
          const [key, name, matcher] = pattern;
          if (!part && !(matcher instanceof RegExp)) {
            continue;
          }
          const child = node.#children[key];
          if (matcher instanceof RegExp) {
            if (partOffsets === null) {
              partOffsets = new Array(len);
              let offset = path[0] === "/" ? 1 : 0;
              for (let p = 0; p < len; p++) {
                partOffsets[p] = offset;
                offset += parts[p].length + 1;
              }
            }
            const restPathString = path.substring(partOffsets[i]);
            const m = matcher.exec(restPathString);
            if (m) {
              params[name] = m[0];
              this.#pushHandlerSets(handlerSets, child, method, node.#params, params);
              if (m[0].length === restPathString.length && child.#children["*"]) {
                this.#pushHandlerSets(
                  handlerSets,
                  child.#children["*"],
                  method,
                  node.#params,
                  params
                );
              }
              if (hasChildren(child.#children)) {
                child.#params = params;
                const componentCount = m[0].match(/\//g)?.length ?? 0;
                const targetCurNodes = curNodesQueue[componentCount] ||= [];
                targetCurNodes.push(child);
              }
              continue;
            }
          }
          if (matcher === true || matcher.test(part)) {
            params[name] = part;
            if (isLast) {
              this.#pushHandlerSets(handlerSets, child, method, params, node.#params);
              if (child.#children["*"]) {
                this.#pushHandlerSets(
                  handlerSets,
                  child.#children["*"],
                  method,
                  params,
                  node.#params
                );
              }
            } else {
              child.#params = params;
              tempNodes.push(child);
            }
          }
        }
      }
      const shifted = curNodesQueue.shift();
      curNodes = shifted ? tempNodes.concat(shifted) : tempNodes;
    }
    if (handlerSets.length > 1) {
      handlerSets.sort((a, b) => {
        return a.score - b.score;
      });
    }
    return [handlerSets.map(({ handler, params }) => [handler, params])];
  }
};

// node_modules/hono/dist/router/trie-router/router.js
var TrieRouter = class {
  static {
    __name(this, "TrieRouter");
  }
  name = "TrieRouter";
  #node;
  constructor() {
    this.#node = new Node2();
  }
  add(method, path, handler) {
    const results = checkOptionalParameter(path);
    if (results) {
      for (let i = 0, len = results.length; i < len; i++) {
        this.#node.insert(method, results[i], handler);
      }
      return;
    }
    this.#node.insert(method, path, handler);
  }
  match(method, path) {
    return this.#node.search(method, path);
  }
};

// node_modules/hono/dist/hono.js
var Hono2 = class extends Hono {
  static {
    __name(this, "Hono");
  }
  /**
   * Creates an instance of the Hono class.
   *
   * @param options - Optional configuration options for the Hono instance.
   */
  constructor(options = {}) {
    super(options);
    this.router = options.router ?? new SmartRouter({
      routers: [new RegExpRouter(), new TrieRouter()]
    });
  }
};

// node_modules/hono/dist/middleware/cors/index.js
var cors = /* @__PURE__ */ __name((options) => {
  const opts = {
    origin: "*",
    allowMethods: ["GET", "HEAD", "PUT", "POST", "DELETE", "PATCH", "QUERY"],
    allowHeaders: [],
    exposeHeaders: [],
    ...options
  };
  const exposeHeadersStr = opts.exposeHeaders?.length ? opts.exposeHeaders.join(",") : void 0;
  const allowHeadersStr = opts.allowHeaders?.length ? opts.allowHeaders.join(",") : void 0;
  const findAllowOrigin = ((optsOrigin) => {
    if (typeof optsOrigin === "string") {
      if (optsOrigin === "*") {
        return () => optsOrigin;
      } else {
        return (origin) => optsOrigin === origin ? origin : null;
      }
    } else if (typeof optsOrigin === "function") {
      return optsOrigin;
    } else {
      return (origin) => optsOrigin.includes(origin) ? origin : null;
    }
  })(opts.origin);
  const findAllowMethods = ((optsAllowMethods) => {
    if (typeof optsAllowMethods === "function") {
      return async (origin, c) => (await optsAllowMethods(origin, c)).join(",");
    } else if (Array.isArray(optsAllowMethods)) {
      const methodsStr = optsAllowMethods.join(",");
      return () => methodsStr;
    } else {
      return () => "";
    }
  })(opts.allowMethods);
  return /* @__PURE__ */ __name(async function cors2(c, next) {
    function set(key, value) {
      c.res.headers.set(key, value);
    }
    __name(set, "set");
    const allowOrigin = await findAllowOrigin(c.req.header("origin") || "", c);
    if (allowOrigin) {
      set("Access-Control-Allow-Origin", allowOrigin);
    }
    if (opts.credentials) {
      set("Access-Control-Allow-Credentials", "true");
    }
    if (exposeHeadersStr) {
      set("Access-Control-Expose-Headers", exposeHeadersStr);
    }
    if (c.req.method === "OPTIONS") {
      if (opts.origin !== "*") {
        set("Vary", "Origin");
      }
      if (opts.maxAge != null) {
        set("Access-Control-Max-Age", opts.maxAge.toString());
      }
      const allowMethods = await findAllowMethods(c.req.header("origin") || "", c);
      if (allowMethods) {
        set("Access-Control-Allow-Methods", allowMethods);
      }
      let headersStr = allowHeadersStr;
      if (!headersStr) {
        const requestHeaders = c.req.header("Access-Control-Request-Headers");
        if (requestHeaders) {
          headersStr = requestHeaders.split(",").map((h) => h.trim()).join(",");
        }
      }
      if (headersStr) {
        set("Access-Control-Allow-Headers", headersStr);
        c.res.headers.append("Vary", "Access-Control-Request-Headers");
      }
      c.res.headers.delete("Content-Length");
      c.res.headers.delete("Content-Type");
      return new Response(null, {
        headers: c.res.headers,
        status: 204,
        statusText: "No Content"
      });
    }
    await next();
    if (opts.origin !== "*") {
      c.header("Vary", "Origin", { append: true });
    }
  }, "cors2");
}, "cors");

// src/worker.js
import settingHtml from "./15e9b0f1de789fe4a120d9b4df80c0fe44d5b96c-setting.html";
import notFoundHtml from "./16244ae3571f7bd40086b7286cddc0dd9ec7ec9c-404.html";
import helpHtml from "./791e70e1e771deee06c3159cb64e3e43e8c75460-help.html";

// src/config.js
var KEY = "hotnews:config";
var defaultConfig = {
  app: {
    timezone: "Asia/Shanghai",
    title: "Hot News \u70ED\u70B9\u901F\u9012"
  },
  // 热榜抓取
  platforms: {
    enabled: true,
    api_url: "",
    // 留空用默认 newsnow 地址
    interval_minutes: 60,
    // 抓取间隔（分钟）
    sources: [
      { id: "toutiao", name: "\u4ECA\u65E5\u5934\u6761", expected_domain: "toutiao.com" },
      { id: "baidu", name: "\u767E\u5EA6\u70ED\u641C", expected_domain: "baidu.com" },
      { id: "wallstreetcn-hot", name: "\u534E\u5C14\u8857\u89C1\u95FB", expected_domain: "wallstreetcn.com" },
      { id: "thepaper", name: "\u6F8E\u6E43\u65B0\u95FB", expected_domain: "thepaper.cn" },
      { id: "bilibili-hot-search", name: "bilibili \u70ED\u641C", expected_domain: "bilibili.com" },
      { id: "cls-hot", name: "\u8D22\u8054\u793E\u70ED\u95E8", expected_domain: "cls.cn" },
      { id: "ifeng", name: "\u51E4\u51F0\u7F51", expected_domain: "ifeng.com" },
      { id: "tieba", name: "\u8D34\u5427", expected_domain: "baidu.com" },
      { id: "weibo", name: "\u5FAE\u535A", expected_domain: "weibo.com" },
      { id: "douyin", name: "\u6296\u97F3", expected_domain: "douyin.com" },
      { id: "zhihu", name: "\u77E5\u4E4E", expected_domain: "zhihu.com" }
    ]
  },
  // RSS 订阅（固定配置，控制面板管理）
  rss: {
    enabled: true,
    max_age_days: 1,
    // RSS 文章新鲜度（推送过滤）
    feeds: [
      { id: "hacker-news", name: "Hacker News", url: "https://hnrss.org/frontpage" },
      { id: "yahoo-finance", name: "\u96C5\u864E\u8D22\u7ECF", url: "https://finance.yahoo.com/news/rssindex" }
    ]
  },
  // 筛选
  filter: {
    method: "keyword",
    // keyword | ai
    keywords: [
      "AI",
      "\u4EBA\u5DE5\u667A\u80FD",
      "OpenAI",
      "\u5927\u6A21\u578B",
      "\u82AF\u7247",
      "\u82F1\u4F1F\u8FBE",
      "\u534E\u4E3A",
      "iPhone",
      "\u82F9\u679C",
      "\u5C0F\u7C73",
      "\u7279\u65AF\u62C9",
      "\u6BD4\u4E9A\u8FEA",
      "\u65B0\u80FD\u6E90",
      "A\u80A1",
      "\u80A1\u5E02",
      "\u7F8E\u8054\u50A8",
      "\u6BD4\u7279\u5E01",
      "\u52A0\u5BC6\u8D27\u5E01"
    ],
    max_news_per_keyword: 5,
    rank_threshold: 5,
    // 排名高亮阈值
    // AI 模式参数
    min_score: 0.7,
    interests: "\u79D1\u6280\u3001AI\u3001\u8D22\u7ECF\u3001\u6C7D\u8F66\u3001\u4E92\u8054\u7F51\u884C\u4E1A\u7684\u91CD\u8981\u65B0\u95FB"
  },
  // AI 模型配置
  ai: {
    provider: "workers-ai",
    // workers-ai（默认）| openai（外部 API）
    api_base: "https://api.deepseek.com/v1",
    api_key: "",
    model: "@cf/meta/llama-3.1-8b-instruct",
    temperature: 0.8,
    max_tokens: 4e3
  },
  // AI 分析
  ai_analysis: {
    enabled: true,
    language: "\u4E2D\u6587",
    max_news_for_analysis: 100,
    include_rss: true
  },
  // AI 翻译
  ai_translation: {
    enabled: false,
    language: "\u4E2D\u6587"
  },
  // 报告
  report: {
    mode: "current",
    // daily | current | incremental
    display_mode: "keyword",
    // keyword | platform
    top_count: 10,
    // 今日焦点（必达）条数
    daily: { enabled: false, time: "21:00" },
    // 定时日报
    weekly: { enabled: false, day: 7, time: "20:00" },
    // 定时周报（day: 1=周一..7=周日）
    // 分类推送（每类一条独立消息，格式：1/N 类别名）
    categories: ["\u7EFC\u5408", "AI", "\u79D1\u6280", "\u6E38\u620F", "\u8D22\u7ECF", "\u65F6\u653F", "\u5176\u4ED6"],
    category_keywords: {
      "AI": ["AI", "\u4EBA\u5DE5\u667A\u80FD", "\u5927\u6A21\u578B", "GPT", "Claude", "Gemini", "Llama", "ChatGPT", "OpenAI", "Anthropic", "xAI", "Grok", "\u7B97\u529B", "GPU", "NVIDIA", "\u82F1\u4F1F\u8FBE", "Cursor"],
      "\u79D1\u6280": ["\u5F00\u6E90", "GitHub", "\u673A\u5668\u4EBA", "\u81EA\u52A8\u9A7E\u9A76", "\u91CF\u5B50", "\u822A\u5929", "\u536B\u661F", "\u82AF\u7247", "\u534A\u5BFC\u4F53", "\u624B\u673A", "\u82F9\u679C", "\u534E\u4E3A", "\u5C0F\u7C73", "OPPO", "vivo", "\u767E\u5EA6", "\u5B57\u8282", "\u817E\u8BAF", "\u963F\u91CC", "\u4EAC\u4E1C", "\u62FC\u591A\u591A", "AI"],
      "\u6E38\u620F": ["\u6E38\u620F", "Steam", "\u539F\u795E", "\u5D29\u94C1", "\u661F\u7A79\u94C1\u9053", "\u9B54\u517D\u4E16\u754C", "PUBG", "APEX", "LOL", "\u82F1\u96C4\u8054\u76DF", "CS", "FPS", "RPG", "Switch", "PS5", "Xbox", "Epic", "\u66B4\u96EA", "\u7C73\u54C8\u6E38", "\u5409\u535C\u529B"],
      "\u8D22\u7ECF": ["\u80A1\u5E02", "A\u80A1", "\u57FA\u91D1", "\u6BD4\u7279\u5E01", "\u52A0\u5BC6\u8D27\u5E01", "\u4EE5\u592A\u574A", "\u7F8E\u8054\u50A8", "\u7F8E\u5143", "\u6CB9\u4EF7", "\u9EC4\u91D1", "\u671F\u8D27", "\u8BC1\u5238", "\u4E0A\u5E02", "IPO", "\u8D22\u62A5", "\u878D\u8D44", "\u4F30\u503C", "\u6C47\u7387", "\u901A\u80C0", "\u964D\u606F"],
      "\u65F6\u653F": ["\u603B\u7EDF", "\u56FD\u4F1A", "\u5916\u4EA4", "\u6218\u4E89", "\u5236\u88C1", "\u8054\u5408\u56FD", "\u5317\u7EA6", "\u62DC\u767B", "\u7279\u6717\u666E", "\u666E\u4EAC", "\u4E60\u8FD1\u5E73", "\u4E3B\u5E2D", "\u56FD\u52A1\u9662", "\u90E8\u957F", "\u5CF0\u4F1A", "\u8C08\u5224", "\u53F0\u6D77", "\u671D\u9C9C", "\u97E9\u56FD", "\u65E5\u672C", "\u4E4C\u514B\u5170"]
    }
  },
  // 推送通知
  notification: {
    enabled: true,
    channels: {
      feishu: { webhook_url: "" },
      dingtalk: { webhook_url: "" },
      wework: { webhook_url: "", msg_type: "markdown" },
      telegram: { bot_token: "", chat_id: "" },
      email: { resend_api_key: "", from: "", to: "" },
      ntfy: { server_url: "https://ntfy.sh", topic: "", token: "" },
      bark: { url: "" },
      slack: { webhook_url: "" },
      generic_webhook: { webhook_url: "", payload_template: "" },
      qq: { app_id: "", app_secret: "", target_type: "group", target_id: "" }
    }
  },
  // 存储（S3 兼容）
  storage: {
    s3: { endpoint: "", bucket: "", access_key: "", secret_key: "", region: "auto", path_prefix: "hot-news" },
    raw_archive: true
    // 每轮抓取原始数据归档 S3
  },
  // 每日备份
  backup: {
    enabled: false,
    time: "23:30",
    // 本地时区 HH:MM，到点触发
    path_prefix: "Daily backup",
    // S3 路径前缀，最终 /Daily backup/YYYY-MM-DD/
    retention_days: 30
  },
  // 数据保留（D1）
  retention: {
    news_days: 30,
    rss_days: 30
  },
  advanced: {
    debug: false
  }
};
function mergeDeep(target, source) {
  if (!source) return target;
  for (const k of Object.keys(source)) {
    const v = source[k];
    if (v === void 0 || v === null) continue;
    if (v && typeof v === "object" && !Array.isArray(v) && target[k] && typeof target[k] === "object" && !Array.isArray(target[k])) {
      target[k] = mergeDeep(target[k], v);
    } else {
      target[k] = v;
    }
  }
  return target;
}
__name(mergeDeep, "mergeDeep");
async function readKV(env, key) {
  if (!env || !env.KV) return null;
  try {
    return await env.KV.get(key);
  } catch (e) {
    return null;
  }
}
__name(readKV, "readKV");
async function writeKV(env, key, val, ttl) {
  if (!env || !env.KV) return;
  try {
    if (ttl) await env.KV.put(key, val, { expirationTtl: ttl });
    else await env.KV.put(key, val);
  } catch (e) {
  }
}
__name(writeKV, "writeKV");
async function getConfig(env) {
  const cfg = JSON.parse(JSON.stringify(defaultConfig));
  const raw2 = await readKV(env, KEY);
  if (raw2) {
    try {
      mergeDeep(cfg, JSON.parse(raw2));
    } catch (e) {
    }
  }
  return cfg;
}
__name(getConfig, "getConfig");
async function saveConfig(env, newCfg) {
  const merged = JSON.parse(JSON.stringify(defaultConfig));
  mergeDeep(merged, newCfg);
  await writeKV(env, KEY, JSON.stringify(merged));
  return merged;
}
__name(saveConfig, "saveConfig");

// src/util/net.js
async function fetchWithTimeout(url, options = {}, retries = 2, timeoutMs = 2e4) {
  let lastErr = null;
  for (let i = 0; i <= retries; i++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        redirect: "follow",
        signal: ctrl.signal,
        ...options
      });
      clearTimeout(timer);
      return res;
    } catch (e) {
      clearTimeout(timer);
      lastErr = e;
      if (i < retries) {
        await new Promise((r) => setTimeout(r, 500 * (i + 1)));
      }
    }
  }
  throw lastErr || new Error("fetch \u5931\u8D25");
}
__name(fetchWithTimeout, "fetchWithTimeout");
async function fetchJson(url, options = {}, retries = 2, timeoutMs = 2e4) {
  const res = await fetchWithTimeout(url, options, retries, timeoutMs);
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${t.slice(0, 200)}`);
  }
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error(`JSON \u89E3\u6790\u5931\u8D25: ${text.slice(0, 200)}`);
  }
}
__name(fetchJson, "fetchJson");
async function fetchText(url, options = {}, retries = 2, timeoutMs = 2e4) {
  const res = await fetchWithTimeout(url, options, retries, timeoutMs);
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${t.slice(0, 200)}`);
  }
  return res.text();
}
__name(fetchText, "fetchText");
var DEFAULT_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

// src/lib/hotlist.js
var DEFAULT_API_URL = "https://newsnow.busiyi.world/api/s";
var FALLBACK_API_URLS = [
  "https://api.newsnowapi.com",
  "https://newsnowapi.com"
];
var DEFAULT_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8"
};
function checkDomainSafety(items, expectedDomain) {
  const expected = String(expectedDomain || "").toLowerCase().trim();
  if (!expected) return null;
  for (const item of items) {
    for (const field of ["url", "mobileUrl"]) {
      const url = item[field];
      if (!url) continue;
      let parsed;
      try {
        parsed = new URL(url);
      } catch (e) {
        return `${url} (URL \u683C\u5F0F\u5F02\u5E38)`;
      }
      if (parsed.protocol !== "https:") return `${url} (\u975E HTTPS)`;
      const hostname = parsed.hostname.toLowerCase();
      if (hostname !== expected && !hostname.endsWith("." + expected)) {
        return `${hostname} (\u6765\u81EA ${url})`;
      }
    }
  }
  return null;
}
__name(checkDomainSafety, "checkDomainSafety");
async function fetchPlatform(apiUrl, id, alias) {
  const url = `${apiUrl}?id=${encodeURIComponent(id)}&latest`;
  try {
    const data = await fetchJson(url, { headers: DEFAULT_HEADERS });
    const status = data.status;
    if (status && status !== "success" && status !== "cache") {
      return { id, alias, items: [], error: `\u54CD\u5E94\u72B6\u6001\u5F02\u5E38: ${status}` };
    }
    const items = [];
    const rawItems = Array.isArray(data.items) ? data.items : [];
    let rank = 0;
    for (const item of rawItems) {
      const title = item.title;
      if (title === null || title === void 0 || typeof title === "number" || !String(title).trim()) continue;
      rank++;
      items.push({
        title: String(title).trim(),
        url: item.url || "",
        mobile_url: item.mobileUrl || "",
        rank
      });
    }
    return { id, alias, items, empty: items.length === 0 };
  } catch (e) {
    return { id, alias, items: [], error: e.message };
  }
}
__name(fetchPlatform, "fetchPlatform");
async function crawlHotlist(cfg, env) {
  const apiUrl = (cfg.platforms.api_url || "").trim() || env && env.NEWSNOW_API_URL || DEFAULT_API_URL;
  const sources = Array.isArray(cfg.platforms.sources) ? cfg.platforms.sources : [];
  const byPlatform = {};
  const failed = [];
  async function tryCrawl(url) {
    const results = await Promise.all(sources.map((s) => fetchPlatform(url, s.id, s.name)));
    const bp = {};
    const fl = [];
    for (const r of results) {
      if (r.error) {
        fl.push({ id: r.id, alias: r.alias, error: r.error });
        continue;
      }
      if (r.empty) {
        fl.push({ id: r.id, alias: r.alias, error: "\u8FD4\u56DE\u6570\u636E\u4E3A\u7A7A" });
        continue;
      }
      const src = sources.find((s) => s.id === r.id);
      const expected = src && src.expected_domain;
      const bad = checkDomainSafety(r.items, expected);
      if (bad) {
        fl.push({ id: r.id, alias: r.alias, error: `\u57DF\u540D\u6821\u9A8C\u5931\u8D25: ${bad}` });
        continue;
      }
      bp[r.id] = { alias: r.alias, items: r.items };
    }
    return { byPlatform: bp, failed: fl };
  }
  __name(tryCrawl, "tryCrawl");
  let result = await tryCrawl(apiUrl);
  if (Object.keys(result.byPlatform).length === 0 && result.failed.length >= sources.length * 0.5) {
    for (const fallback of FALLBACK_API_URLS) {
      try {
        result = await tryCrawl(fallback);
        if (Object.keys(result.byPlatform).length > 0) break;
      } catch (_) {
      }
    }
  }
  const failedIds = new Set(failed.map((f) => f.id));
  for (const f of result.failed) {
    if (!failedIds.has(f.id)) failed.push(f);
  }
  Object.assign(byPlatform, result.byPlatform);
  return { byPlatform, failed };
}
__name(crawlHotlist, "crawlHotlist");

// src/lib/ai.js
async function chat(cfg, env, messages, opts = {}) {
  const aiCfg = cfg.ai || {};
  const maxTokens = opts.max_tokens ?? aiCfg.max_tokens ?? 4e3;
  const temperature = opts.temperature ?? aiCfg.temperature ?? 0.8;
  if (aiCfg.provider === "workers-ai" && env && env.AI) {
    const model2 = aiCfg.model || "@cf/meta/llama-3.1-8b-instruct";
    try {
      const res2 = await env.AI.run(model2, {
        messages,
        max_tokens: maxTokens,
        temperature
      });
      return res2 && (res2.response || res2.result && res2.result.response) || "";
    } catch (e) {
      throw new Error(`Workers AI \u8BF7\u6C42\u5931\u8D25: ${e.message}`);
    }
  }
  const base = (aiCfg.api_base || "").trim().replace(/\/+$/, "") || "https://api.deepseek.com/v1";
  const apiKey = aiCfg.api_key || env?.AI_API_KEY || "";
  if (!apiKey) throw new Error("\u672A\u914D\u7F6E AI API Key");
  const model = aiCfg.model || "deepseek-chat";
  const url = `${base}/chat/completions`;
  const res = await fetchJson(
    url,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + apiKey
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: maxTokens,
        temperature
      })
    },
    1,
    12e4
  );
  const content = res.choices && res.choices[0] && res.choices[0].message && res.choices[0].message.content;
  if (content === void 0 || content === null) throw new Error("AI \u54CD\u5E94\u683C\u5F0F\u5F02\u5E38");
  return String(content).trim();
}
__name(chat, "chat");
function extractJson(text) {
  if (!text) return null;
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  try {
    return JSON.parse(t);
  } catch (e) {
    const s = t.indexOf("{");
    const en = t.lastIndexOf("}");
    if (s !== -1 && en > s) {
      try {
        return JSON.parse(t.slice(s, en + 1));
      } catch (e2) {
      }
    }
    return null;
  }
}
__name(extractJson, "extractJson");
function aiAvailable(cfg, env) {
  const aiCfg = cfg.ai || {};
  if (aiCfg.provider === "workers-ai") return !!(env && env.AI);
  return !!(aiCfg.api_key || env && env.AI_API_KEY);
}
__name(aiAvailable, "aiAvailable");

// src/lib/filter.js
function keywordMatch(text, keyword) {
  if (!keyword) return false;
  const k = String(keyword).trim();
  if (!k) return false;
  return String(text).toLowerCase().includes(k.toLowerCase());
}
__name(keywordMatch, "keywordMatch");
function filterByKeywords(items, keywords) {
  const matched = [];
  const seen = /* @__PURE__ */ new Set();
  const kwList = (keywords || []).filter((k) => k && String(k).trim());
  for (const item of items) {
    const title = item.title || "";
    for (const kw of kwList) {
      if (keywordMatch(title, kw)) {
        const key = kw + "|" + (item.url || item.title);
        if (!seen.has(key)) {
          seen.add(key);
          matched.push({ keyword: kw, item });
        }
      }
    }
  }
  return { matched, matchedCount: matched.length };
}
__name(filterByKeywords, "filterByKeywords");
async function filterByAI(cfg, env, items, interests) {
  const titleList = items.map((it, i) => `${i + 1}. ${it.title}`).join("\n");
  const prompt = `\u4F60\u662F\u65B0\u95FB\u7B5B\u9009\u52A9\u624B\u3002\u6839\u636E\u7528\u6237\u5174\u8DA3\u63CF\u8FF0\uFF0C\u4ECE\u4E0B\u5217\u65B0\u95FB\u4E2D\u9009\u51FA\u76F8\u5173\u4E14\u91CD\u8981\u7684\uFF0C\u8FD4\u56DE JSON \u6570\u7EC4\uFF0C\u6BCF\u4E2A\u5143\u7D20\u4E3A\u9009\u4E2D\u65B0\u95FB\u7684\u5E8F\u53F7\uFF08\u6570\u5B57\uFF09\u3002
\u7528\u6237\u5174\u8DA3\uFF1A${interests || "\u79D1\u6280\u3001\u8D22\u7ECF\u3001AI\u3001\u4E92\u8054\u7F51"}
\u65B0\u95FB\u5217\u8868\uFF1A
${titleList}
\u53EA\u8FD4\u56DE JSON\uFF0C\u5982 [1, 3, 5]\u3002`;
  const raw2 = await chat(cfg, env, [
    { role: "system", content: "\u4F60\u8F93\u51FA\u4E25\u683C JSON\uFF0C\u4E0D\u5305\u542B\u4EFB\u4F55\u5176\u4ED6\u6587\u5B57\u3002" },
    { role: "user", content: prompt }
  ], { max_tokens: 2e3 });
  const arr = extractJson(raw2);
  if (!Array.isArray(arr)) return { matched: [], error: "AI \u8FD4\u56DE\u683C\u5F0F\u5F02\u5E38" };
  const matched = [];
  for (const n of arr) {
    const idx = Number(n) - 1;
    if (idx >= 0 && idx < items.length) matched.push({ keyword: "AI", item: items[idx] });
  }
  return { matched, error: null };
}
__name(filterByAI, "filterByAI");

// src/util/time.js
var DEFAULT_TZ = "Asia/Shanghai";
function tzParts(date, tz) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz || DEFAULT_TZ,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
  const parts = dtf.formatToParts(date || /* @__PURE__ */ new Date());
  const map = {};
  for (const p of parts) map[p.type] = p.value;
  if (map.hour === "24") map.hour = "00";
  return map;
}
__name(tzParts, "tzParts");
function tzOffsetMinutes(tz, date) {
  const p = tzParts(date || /* @__PURE__ */ new Date(), tz);
  const asUTC = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour),
    Number(p.minute),
    Number(p.second)
  );
  const now = date ? date.getTime() : Date.now();
  return Math.round((asUTC - now) / 6e4);
}
__name(tzOffsetMinutes, "tzOffsetMinutes");
function todayStr(tz) {
  const p = tzParts(/* @__PURE__ */ new Date(), tz);
  return `${p.year}-${p.month}-${p.day}`;
}
__name(todayStr, "todayStr");
function nowMinuteStr(tz) {
  const p = tzParts(/* @__PURE__ */ new Date(), tz);
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}
__name(nowMinuteStr, "nowMinuteStr");
function nowClock(tz) {
  const p = tzParts(/* @__PURE__ */ new Date(), tz);
  return `${p.hour}:${p.minute}`;
}
__name(nowClock, "nowClock");
function localToTs(localStr, tz) {
  const m = String(localStr).match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (!m) return Date.now();
  const [, y, mo, d, h, mi] = m;
  const offset = tzOffsetMinutes(tz);
  return Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi)) - offset * 6e4;
}
__name(localToTs, "localToTs");
function isoToDateStr(iso, tz) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const p = tzParts(d, tz);
  return `${p.year}-${p.month}-${p.day}`;
}
__name(isoToDateStr, "isoToDateStr");

// src/lib/report.js
function normalizeTitle(t) {
  return String(t || "").trim().replace(/\s+/g, " ").replace(/[。．.!！?？…]+$/g, "").toLowerCase();
}
__name(normalizeTitle, "normalizeTitle");
function dedupeItems(items) {
  const map = /* @__PURE__ */ new Map();
  for (const it of items || []) {
    const k = normalizeTitle(it.title);
    if (!k) continue;
    const pn = it.platform_name || it.platform_id || "";
    if (map.has(k)) {
      const ex = map.get(k);
      if (ex.rank != null && it.rank != null) ex.rank = Math.min(ex.rank, it.rank);
      else if (ex.rank == null && it.rank != null) ex.rank = it.rank;
      if (pn && !ex.platforms.includes(pn)) ex.platforms.push(pn);
      if (!ex.url && it.url) ex.url = it.url;
      continue;
    }
    map.set(k, { ...it, rank: it.rank != null ? it.rank : null, platforms: pn ? [pn] : [] });
  }
  const out = [...map.values()].map((it) => {
    it.platform = it.platforms.join("/");
    delete it.platforms;
    return it;
  });
  out.sort((a, b) => (a.rank == null ? 9999 : a.rank) - (b.rank == null ? 9999 : b.rank));
  return out;
}
__name(dedupeItems, "dedupeItems");
function globalDedupe(items) {
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (const it of items || []) {
    const k = normalizeTitle(it.title);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(it);
  }
  return out;
}
__name(globalDedupe, "globalDedupe");
function classifyItem(item, cfg) {
  const text = ((item.title || "") + " " + (item.description || item.summary || "")).toLowerCase();
  const cats = cfg.report.categories || [];
  const kw = cfg.report.category_keywords || {};
  for (const cat of cats) {
    if (cat === "\u7EFC\u5408" || cat === "\u5176\u4ED6") continue;
    const keywords = kw[cat] || [];
    if (keywords.some((k) => text.includes(k.toLowerCase()))) return cat;
  }
  return "\u7EFC\u5408";
}
__name(classifyItem, "classifyItem");
function fmtItem(it) {
  const p = it.platform || it.platform_name || it.platform_id || "\u70ED\u699C";
  const title = (it.title || "").trim() || "(\u65E0\u6807\u9898)";
  let summary = "";
  const raw2 = (it.description || it.summary || "").replace(/\n/g, " ").replace(/<[^>]+>/g, "").trim();
  if (raw2) {
    summary = raw2.length > 100 ? raw2.slice(0, 100) + "\u2026" : raw2;
  }
  const src = it.feed_name ? `\uFF08${it.feed_name}\uFF09` : "";
  return summary ? `\u2022 [${p}] ${title} \u2014 ${summary}${src}` : `\u2022 [${p}] ${title}${src}`;
}
__name(fmtItem, "fmtItem");
function renderParts(cfg, data) {
  const { title: appTitle, timeStr, top, hotlist, rss, rssAlways, analysis } = data;
  const categories = cfg.report.categories || ["\u7EFC\u5408", "AI", "\u79D1\u6280", "\u6E38\u620F", "\u8D22\u7ECF", "\u65F6\u653F"];
  const parts = [];
  const hotItems = [];
  if (top && top.length) hotItems.push(...top.map((it) => ({ ...it, _source: "top" })));
  if (hotlist && hotlist.groups) {
    for (const key of Object.keys(hotlist.groups)) {
      for (const it of hotlist.groups[key]) hotItems.push({ ...it, _source: "hotlist" });
    }
  }
  if (rss && rss.length) hotItems.push(...rss.map((it) => ({ ...it, _source: "rss" })));
  const deduped = globalDedupe(hotItems);
  const grouped = {};
  for (const cat of categories) grouped[cat] = [];
  for (const it of deduped) grouped[classifyItem(it, cfg)].push(it);
  const nonEmpty = categories.filter((cat) => (grouped[cat] || []).length);
  const totalParts = nonEmpty.length || 1;
  let idx = 0;
  for (const cat of categories) {
    const items = grouped[cat] || [];
    if (!items.length) continue;
    idx++;
    const lines = [];
    lines.push(`\u3010\u70ED\u70B9\u8D44\u8BAF\u3011${timeStr}  \xB7  ${idx}/${totalParts}  ${cat}`);
    const max = 30;
    items.slice(0, max).forEach((it) => lines.push(fmtItem(it)));
    if (items.length > max) lines.push(`\u2026 \u5171 ${items.length} \u6761`);
    lines.push("");
    lines.push("\u{1F4A1} \u6570\u636E\u6765\u6E90\uFF1A\u70ED\u699C\u6293\u53D6");
    parts.push({ type: "part", category: cat, text: lines.join("\n"), itemsCount: items.length });
  }
  if (rssAlways && rssAlways.length) {
    const bySub = {};
    for (const it of rssAlways) {
      const name = it.feed_name || "\u672A\u77E5\u8BA2\u9605";
      (bySub[name] = bySub[name] || []).push(it);
    }
    const subNames = Object.keys(bySub);
    subNames.forEach((name, i) => {
      const items = bySub[name];
      const lines = [];
      lines.push(`\u3010\u8BA2\u9605\u66F4\u65B0\u3011${timeStr}  \xB7  ${name}`);
      const max = 20;
      items.slice(0, max).forEach((it) => lines.push(fmtItem(it)));
      if (items.length > max) lines.push(`\u2026 \u5171 ${items.length} \u6761`);
      lines.push("");
      lines.push("\u{1F4A1} \u6570\u636E\u6765\u6E90\uFF1A\u81EA\u5B9A\u4E49\u8BA2\u9605");
      parts.push({ type: "sub", subName: name, text: lines.join("\n"), itemsCount: items.length });
    });
  }
  if (analysis) {
    const alines = [];
    alines.push(`\u3010AI \u4ECA\u65E5\u603B\u7ED3\u3011${timeStr}`);
    alines.push("");
    alines.push(analysis);
    alines.push("");
    alines.push("\u{1F916} \u6570\u636E\u6765\u6E90\uFF1AAI \u5206\u6790");
    parts.push({ type: "analysis", text: alines.join("\n") });
  }
  return parts;
}
__name(renderParts, "renderParts");

// src/push/feishu.js
async function send(ch, text) {
  const { webhook_url } = ch;
  if (!webhook_url) return { channel: "feishu", ok: false, error: "\u672A\u914D\u7F6E Webhook" };
  const body = {
    msg_type: "text",
    content: { text }
  };
  try {
    const res = await fetchWithTimeout(webhook_url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => null);
    const ok = res.ok && data && data.code === 0;
    return { channel: "feishu", ok, error: ok ? void 0 : `HTTP ${res.status}` };
  } catch (e) {
    return { channel: "feishu", ok: false, error: e.message };
  }
}
__name(send, "send");
var feishu_default = { send };

// src/push/dingtalk.js
async function send2(ch, text) {
  const { webhook_url } = ch;
  if (!webhook_url) return { channel: "dingtalk", ok: false, error: "\u672A\u914D\u7F6E Webhook" };
  const body = {
    msgtype: "text",
    text: { content: text }
  };
  try {
    const res = await fetchWithTimeout(webhook_url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => null);
    const ok = res.ok && data && data.errcode === 0;
    return { channel: "dingtalk", ok, error: ok ? void 0 : `HTTP ${res.status}` };
  } catch (e) {
    return { channel: "dingtalk", ok: false, error: e.message };
  }
}
__name(send2, "send");
var dingtalk_default = { send: send2 };

// src/push/wework.js
async function send3(ch, text) {
  const { webhook_url, msg_type = "markdown" } = ch;
  if (!webhook_url) return { channel: "wework", ok: false, error: "\u672A\u914D\u7F6E Webhook" };
  let body;
  if (msg_type === "markdown") {
    body = { msgtype: "markdown", markdown: { content: text } };
  } else {
    body = { msgtype: "text", text: { content: text } };
  }
  try {
    const res = await fetchWithTimeout(webhook_url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => null);
    const ok = res.ok && data && data.errcode === 0;
    return { channel: "wework", ok, error: ok ? void 0 : `HTTP ${res.status}` };
  } catch (e) {
    return { channel: "wework", ok: false, error: e.message };
  }
}
__name(send3, "send");
var wework_default = { send: send3 };

// src/push/telegram.js
function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
__name(escapeHtml, "escapeHtml");
async function send4(ch, text) {
  const { bot_token, chat_id } = ch;
  if (!bot_token || !chat_id) return { channel: "telegram", ok: false, error: "\u672A\u914D\u7F6E Bot Token/Chat ID" };
  try {
    const data = await fetchJson(`https://api.telegram.org/bot${bot_token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id,
        text: escapeHtml(text),
        parse_mode: "HTML",
        disable_web_page_preview: true
      })
    });
    const ok = !!(data && data.ok);
    return { channel: "telegram", ok, error: ok ? void 0 : (data.description || "\u53D1\u9001\u5931\u8D25").slice(0, 200) };
  } catch (e) {
    return { channel: "telegram", ok: false, error: e.message };
  }
}
__name(send4, "send");
var telegram_default = { send: send4 };

// src/push/email.js
async function send5(ch, text) {
  const { resend_api_key, from, to } = ch;
  if (!resend_api_key || !to) return { channel: "email", ok: false, error: "\u672A\u914D\u7F6E Resend Key/\u6536\u4EF6\u4EBA" };
  try {
    const data = await fetchJson("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resend_api_key}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: from || "HotNews <onboarding@resend.dev>",
        to: String(to).split(",").map((s) => s.trim()).filter(Boolean),
        subject: "\u70ED\u70B9\u901F\u62A5",
        text
      })
    });
    const ok = !!(data && data.id);
    return { channel: "email", ok, error: ok ? void 0 : (data.message || "\u53D1\u9001\u5931\u8D25").slice(0, 200) };
  } catch (e) {
    return { channel: "email", ok: false, error: e.message };
  }
}
__name(send5, "send");
var email_default = { send: send5 };

// src/push/ntfy.js
async function send6(ch, text) {
  const { server_url, topic, token } = ch;
  if (!topic) return { channel: "ntfy", ok: false, error: "\u672A\u914D\u7F6E Topic" };
  const url = (server_url || "https://ntfy.sh").replace(/\/$/, "") + "/" + topic;
  const headers = { "Content-Type": "text/plain" };
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    const res = await fetchWithTimeout(url, { method: "POST", headers, body: text });
    const ok = res.ok;
    return { channel: "ntfy", ok, error: ok ? void 0 : `HTTP ${res.status}` };
  } catch (e) {
    return { channel: "ntfy", ok: false, error: e.message };
  }
}
__name(send6, "send");
var ntfy_default = { send: send6 };

// src/push/bark.js
async function send7(ch, text) {
  const { url } = ch;
  if (!url) return { channel: "bark", ok: false, error: "\u672A\u914D\u7F6E URL" };
  try {
    const res = await fetchWithTimeout(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "\u70ED\u70B9\u901F\u62A5", body: text })
    });
    const ok = res.ok;
    return { channel: "bark", ok, error: ok ? void 0 : `HTTP ${res.status}` };
  } catch (e) {
    return { channel: "bark", ok: false, error: e.message };
  }
}
__name(send7, "send");
var bark_default = { send: send7 };

// src/push/slack.js
async function send8(ch, text) {
  const { webhook_url } = ch;
  if (!webhook_url) return { channel: "slack", ok: false, error: "\u672A\u914D\u7F6E Webhook" };
  try {
    const res = await fetchWithTimeout(webhook_url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    });
    const ok = res.ok;
    return { channel: "slack", ok, error: ok ? void 0 : `HTTP ${res.status}` };
  } catch (e) {
    return { channel: "slack", ok: false, error: e.message };
  }
}
__name(send8, "send");
var slack_default = { send: send8 };

// src/push/generic.js
async function send9(ch, text, env, subject) {
  const { webhook_url, payload_template } = ch;
  if (!webhook_url) return { channel: "generic_webhook", ok: false, error: "\u672A\u914D\u7F6E Webhook" };
  try {
    const template = payload_template || '{"content":"{content}"}';
    const payload = template.replace(/\{title\}/g, subject || "\u70ED\u70B9\u901F\u62A5").replace(/\{content\}/g, text);
    const res = await fetchWithTimeout(webhook_url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload
    });
    const ok = res.ok;
    return { channel: "generic_webhook", ok, error: ok ? void 0 : `HTTP ${res.status}` };
  } catch (e) {
    return { channel: "generic_webhook", ok: false, error: e.message };
  }
}
__name(send9, "send");
var generic_default = { send: send9 };

// src/push/qq.js
var TOKEN_KEY = "hotnews:qq:token";
async function getToken(env, ch) {
  if (env && env.KV) {
    const cached = await env.KV.get(TOKEN_KEY, "json").catch(() => null);
    if (cached && cached.access_token && cached.expires_at > Date.now()) return cached.access_token;
  }
  try {
    const data = await fetchJson("https://bots.qq.com/app/getAppAccessToken", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appId: ch.app_id, clientSecret: ch.app_secret })
    });
    if (!data || !data.access_token) throw new Error(data.message || "\u83B7\u53D6 token \u5931\u8D25");
    if (env && env.KV) {
      await env.KV.put(
        TOKEN_KEY,
        JSON.stringify({
          access_token: data.access_token,
          expires_at: Date.now() + (data.expires_in || 7200) * 1e3 - 3e5
        })
      );
    }
    return data.access_token;
  } catch (e) {
    throw new Error("QQ token \u83B7\u53D6\u5931\u8D25: " + e.message);
  }
}
__name(getToken, "getToken");
async function send10(ch, text, env) {
  const { app_id, app_secret, target_type, target_id } = ch;
  if (!app_id || !app_secret || !target_id) return { channel: "qq", ok: false, error: "\u672A\u914D\u7F6E App ID/Secret/\u76EE\u6807" };
  try {
    const token = await getToken(env, ch);
    const base = target_type === "c2c" ? `/v2/users/${target_id}/messages` : target_type === "channel" ? `/v2/channels/${target_id}/messages` : `/v2/groups/${target_id}/messages`;
    const res = await fetchWithTimeout("https://api.sgroup.qq.com" + base, {
      method: "POST",
      headers: { Authorization: `Bot ${app_id}.${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ content: text, msg_type: 0 })
    });
    const body = await res.json().catch(() => null);
    const code = body && body.code;
    if (!res.ok) {
      const msg = body && body.message || body && body.msg || "";
      return { channel: "qq", ok: false, error: `HTTP ${res.status} ${msg}`.trim() };
    }
    if (code && code !== 0) {
      return { channel: "qq", ok: false, error: `QQ ${code} ${(body.message || body.msg || "").trim()}`.trim() };
    }
    return { channel: "qq", ok: true };
  } catch (e) {
    return { channel: "qq", ok: false, error: e.message };
  }
}
__name(send10, "send");
var qq_default = { send: send10 };

// src/push/index.js
var CHANNELS = { feishu: feishu_default, dingtalk: dingtalk_default, wework: wework_default, telegram: telegram_default, email: email_default, ntfy: ntfy_default, bark: bark_default, slack: slack_default, generic_webhook: generic_default, qq: qq_default };
function isConfigured(name, ch) {
  switch (name) {
    case "feishu":
    case "dingtalk":
    case "wework":
    case "slack":
      return !!ch.webhook_url;
    case "telegram":
      return !!(ch.bot_token && ch.chat_id);
    case "email":
      return !!(ch.resend_api_key && ch.to);
    case "ntfy":
      return !!ch.topic;
    case "bark":
      return !!ch.url;
    case "generic_webhook":
      return !!ch.webhook_url;
    case "qq":
      return !!(ch.app_id && ch.app_secret && ch.target_id);
    default:
      return false;
  }
}
__name(isConfigured, "isConfigured");
function configuredChannels(channels) {
  const list = [];
  for (const name of Object.keys(CHANNELS)) {
    const ch = channels[name];
    if (ch && isConfigured(name, ch)) list.push({ name, cfg: ch });
  }
  return list;
}
__name(configuredChannels, "configuredChannels");
async function push(env, cfg, text, subject) {
  const notif = cfg.notification || {};
  if (!notif.enabled) return [{ channel: "all", ok: false, error: "\u901A\u77E5\u603B\u5F00\u5173\u5173\u95ED" }];
  const list = configuredChannels(notif.channels || {});
  if (list.length === 0) return [{ channel: "all", ok: false, error: "\u672A\u914D\u7F6E\u4EFB\u4F55\u63A8\u9001\u901A\u9053" }];
  const results = [];
  for (const { name, cfg: ch } of list) {
    try {
      const mod = CHANNELS[name];
      const res = await mod.send(ch, text, env);
      results.push(res);
    } catch (e) {
      results.push({ channel: name, ok: false, error: e.message });
    }
  }
  return results;
}
__name(push, "push");
var push_default = { push, configuredChannels, isConfigured };

// src/storage/d1.js
async function ensureSchema(env) {
  if (!env.DB) return false;
  try {
    await env.DB.prepare(`
			CREATE TABLE IF NOT EXISTS news_items (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				title TEXT NOT NULL,
				platform_id TEXT NOT NULL,
				rank INTEGER NOT NULL,
				url TEXT DEFAULT '',
				mobile_url TEXT DEFAULT '',
				date TEXT NOT NULL,
				first_crawl_time TEXT NOT NULL,
				last_crawl_time TEXT NOT NULL,
				crawl_count INTEGER DEFAULT 1,
				created_at TEXT DEFAULT (datetime('now'))
			)
		`).run();
    await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_news_date ON news_items(date)`).run();
    await env.DB.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_news_url_platform_date ON news_items(url, platform_id, date) WHERE url != ''`).run();
    await env.DB.prepare(`
			CREATE TABLE IF NOT EXISTS rank_history (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				news_item_id INTEGER NOT NULL,
				rank INTEGER NOT NULL,
				crawl_time TEXT NOT NULL,
				created_at TEXT DEFAULT (datetime('now'))
			)
		`).run();
    await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_rank_history_news ON rank_history(news_item_id)`).run();
    await env.DB.prepare(`
			CREATE TABLE IF NOT EXISTS rss_feeds (
				id TEXT PRIMARY KEY,
				name TEXT NOT NULL,
				feed_url TEXT DEFAULT '',
				is_active INTEGER DEFAULT 1,
				last_fetch_time TEXT,
				last_fetch_status TEXT,
				item_count INTEGER DEFAULT 0,
				created_at TEXT DEFAULT (datetime('now')),
				updated_at TEXT DEFAULT (datetime('now'))
			)
		`).run();
    await env.DB.prepare(`
			CREATE TABLE IF NOT EXISTS rss_items (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				title TEXT NOT NULL,
				feed_id TEXT NOT NULL,
				url TEXT NOT NULL,
				guid TEXT DEFAULT '',
				date TEXT NOT NULL,
				published_at TEXT,
				summary TEXT,
				author TEXT,
				first_crawl_time TEXT NOT NULL,
				last_crawl_time TEXT NOT NULL,
				crawl_count INTEGER DEFAULT 1,
				created_at TEXT DEFAULT (datetime('now'))
			)
		`).run();
    await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_rss_feed ON rss_items(feed_id)`).run();
    await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_rss_items_date ON rss_items(date)`).run();
    await env.DB.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_rss_url_feed_date ON rss_items(url, feed_id, date)`).run();
    await env.DB.prepare(`
			CREATE TABLE IF NOT EXISTS push_records (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				date TEXT NOT NULL,
				push_time TEXT NOT NULL,
				item_count INTEGER DEFAULT 0,
				mode TEXT DEFAULT '',
				created_at TEXT DEFAULT (datetime('now'))
			)
		`).run();
    await env.DB.prepare(`
			CREATE TABLE IF NOT EXISTS crawl_records (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				crawl_time TEXT NOT NULL UNIQUE,
				kind TEXT DEFAULT 'hotlist',
				total_items INTEGER DEFAULT 0,
				detail TEXT,
				created_at TEXT DEFAULT (datetime('now'))
			)
		`).run();
    return true;
  } catch (e) {
    console.error("ensureSchema \u5931\u8D25", e);
    return false;
  }
}
__name(ensureSchema, "ensureSchema");
async function upsertNewsItems(env, items, dateStr) {
  if (!env.DB || !items || items.length === 0) return 0;
  let added = 0;
  const stmt = env.DB.prepare(`
		INSERT INTO news_items (title, platform_id, rank, url, mobile_url, date, first_crawl_time, last_crawl_time, crawl_count)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
		ON CONFLICT(url, platform_id, date) WHERE url != '' DO UPDATE SET
			last_crawl_time = excluded.last_crawl_time,
			crawl_count = news_items.crawl_count + 1
	`);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const rows = items.map(
    (it) => stmt.bind(it.title, it.platform_id, it.rank, it.url || "", it.mobile_url || "", dateStr, now, now)
  );
  for (let i = 0; i < rows.length; i += 100) {
    await env.DB.batch(rows.slice(i, i + 100)).catch(() => {
    });
  }
  return items.length;
}
__name(upsertNewsItems, "upsertNewsItems");
async function recordRanks(env, items, dateStr) {
  if (!env.DB || !items || items.length === 0) return;
  try {
    const ids = await env.DB.batch(
      items.slice(0, 500).map(
        (it) => env.DB.prepare("SELECT id FROM news_items WHERE url = ? AND platform_id = ? AND date = ?").bind(it.url || "", it.platform_id, dateStr)
      )
    );
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const rankRows = [];
    ids.forEach((res, i) => {
      const r = res.results ? res.results[0] : res[0];
      if (r && r.id) rankRows.push(env.DB.prepare("INSERT INTO rank_history (news_item_id, rank, crawl_time) VALUES (?, ?, ?)").bind(r.id, items[i].rank, now));
    });
    if (rankRows.length) await env.DB.batch(rankRows.slice(0, 500)).catch(() => {
    });
  } catch (e) {
  }
}
__name(recordRanks, "recordRanks");
async function getNewsByDate(env, dateStr, platformIds) {
  if (!env.DB) return {};
  try {
    let sql = "SELECT * FROM news_items WHERE date = ?";
    const binds = [dateStr];
    if (platformIds && platformIds.length) {
      sql += " AND platform_id IN (" + platformIds.map(() => "?").join(",") + ")";
      binds.push(...platformIds);
    }
    sql += " ORDER BY platform_id, rank ASC";
    const res = await env.DB.prepare(sql).bind(...binds).all();
    const grouped = {};
    for (const row of res.results) {
      (grouped[row.platform_id] = grouped[row.platform_id] || []).push(row);
    }
    return grouped;
  } catch (e) {
    return {};
  }
}
__name(getNewsByDate, "getNewsByDate");
async function upsertRssItems(env, items, dateStr) {
  if (!env.DB || !items || items.length === 0) return 0;
  const stmt = env.DB.prepare(`
		INSERT INTO rss_items (title, feed_id, url, guid, date, published_at, summary, author, first_crawl_time, last_crawl_time, crawl_count)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
		ON CONFLICT(url, feed_id, date) DO UPDATE SET
			last_crawl_time = excluded.last_crawl_time,
			crawl_count = rss_items.crawl_count + 1
	`);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const rows = items.map(
    (it) => stmt.bind(it.title, it.feed_id, it.url || "", it.guid || "", dateStr, it.published_at || "", it.summary || "", it.author || "", now, now)
  );
  let added = 0;
  for (let i = 0; i < rows.length; i += 100) {
    const batch = rows.slice(i, i + 100);
    const res = await env.DB.batch(batch).catch(() => batch.map(() => ({ success: false })));
    res.forEach((r) => {
      if (r && r.success !== false && r.meta && r.meta.changes && r.meta.changes > 0) added += r.meta.changes;
    });
  }
  return added;
}
__name(upsertRssItems, "upsertRssItems");
async function updateRssFeedStatus(env, feedId, status, itemCount) {
  if (!env.DB) return;
  try {
    await env.DB.prepare(`
			INSERT INTO rss_feeds (id, name, feed_url, is_active, last_fetch_time, last_fetch_status, item_count)
			VALUES (?, '', '', 1, ?, ?, ?)
			ON CONFLICT(id) DO UPDATE SET
				last_fetch_time = excluded.last_fetch_time,
				last_fetch_status = excluded.last_fetch_status,
				item_count = excluded.item_count,
				updated_at = datetime('now')
		`).bind(feedId, (/* @__PURE__ */ new Date()).toISOString(), status, itemCount).run();
  } catch (e) {
  }
}
__name(updateRssFeedStatus, "updateRssFeedStatus");
async function getRssByDate(env, dateStr, feedIds) {
  if (!env.DB) return [];
  try {
    let sql = "SELECT * FROM rss_items WHERE date = ?";
    const binds = [dateStr];
    if (feedIds && feedIds.length) {
      sql += " AND feed_id IN (" + feedIds.map(() => "?").join(",") + ")";
      binds.push(...feedIds);
    }
    sql += " ORDER BY published_at DESC, id DESC LIMIT 500";
    const res = await env.DB.prepare(sql).bind(...binds).all();
    return res.results;
  } catch (e) {
    return [];
  }
}
__name(getRssByDate, "getRssByDate");
async function purgeOldData(env, retentionDays) {
  if (!env.DB || !retentionDays || retentionDays <= 0) return;
  try {
    const date = /* @__PURE__ */ new Date();
    date.setDate(date.getDate() - retentionDays);
    const cutoff = date.toISOString().slice(0, 10);
    await env.DB.prepare("DELETE FROM news_items WHERE date < ?").bind(cutoff).run();
    await env.DB.prepare("DELETE FROM rss_items WHERE date < ?").bind(cutoff).run();
    await env.DB.prepare("DELETE FROM rank_history WHERE news_item_id NOT IN (SELECT id FROM news_items)").run();
  } catch (e) {
  }
}
__name(purgeOldData, "purgeOldData");
async function recordCrawl(env, kind, totalItems, detail) {
  if (!env.DB) return;
  try {
    await env.DB.prepare("INSERT OR IGNORE INTO crawl_records (crawl_time, kind, total_items, detail) VALUES (?, ?, ?, ?)").bind((/* @__PURE__ */ new Date()).toISOString(), kind, totalItems, detail || "").run();
  } catch (e) {
  }
}
__name(recordCrawl, "recordCrawl");

// src/storage/s3.js
var enc = new TextEncoder();
async function sha2562(data) {
  const buf = await crypto.subtle.digest("SHA-256", typeof data === "string" ? enc.encode(data) : data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(sha2562, "sha256");
async function hmac(key, data) {
  const k = typeof key === "string" ? enc.encode(key) : key;
  return crypto.subtle.importKey("raw", k, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]).then((kk) => crypto.subtle.sign("HMAC", kk, typeof data === "string" ? enc.encode(data) : data));
}
__name(hmac, "hmac");
async function hmacHex(key, data) {
  const buf = await hmac(key, data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(hmacHex, "hmacHex");
function parseEndpoint(endpoint) {
  let url;
  if (/^https?:\/\//i.test(endpoint)) url = new URL(endpoint);
  else url = new URL("https://" + endpoint);
  return { host: url.host, scheme: url.protocol.replace(":", "") };
}
__name(parseEndpoint, "parseEndpoint");
function encodePath(path) {
  return path.split("/").map((seg) => encodeURIComponent(seg)).join("/");
}
__name(encodePath, "encodePath");
async function putObject(opts) {
  const ep = parseEndpoint(opts.endpoint);
  const region = opts.region || "auto";
  const service = "s3";
  const now = /* @__PURE__ */ new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const dateStamp = amzDate.slice(0, 8);
  const body = typeof opts.body === "string" ? enc.encode(opts.body) : opts.body;
  const payloadHash = await sha2562(body);
  const path = "/" + encodePath(opts.bucket + "/" + opts.key);
  const contentType = opts.contentType || "application/octet-stream";
  const headers = {
    host: ep.host,
    "x-amz-date": amzDate,
    "x-amz-content-sha256": payloadHash,
    "content-type": contentType
  };
  const canonicalHeaders = Object.keys(headers).sort().map((k) => k + ":" + String(headers[k]).trim() + "\n").join("");
  const signedHeaders = Object.keys(headers).sort().join(";");
  const canonicalRequest = [
    "PUT",
    path,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join("\n");
  const scope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    await sha2562(canonicalRequest)
  ].join("\n");
  let signingKey = await hmac("AWS4" + opts.secretKey, dateStamp);
  signingKey = await hmac(signingKey, region);
  signingKey = await hmac(signingKey, service);
  signingKey = await hmac(signingKey, "aws4_request");
  const signature = await hmacHex(signingKey, stringToSign);
  const authorization = `AWS4-HMAC-SHA256 Credential=${opts.accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  const url = `${ep.scheme}://${ep.host}${path}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
      "X-Amz-Date": amzDate,
      "X-Amz-Content-Sha256": payloadHash,
      "Authorization": authorization
    },
    body
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`S3 \u4E0A\u4F20\u5931\u8D25: HTTP ${res.status} ${t.slice(0, 200)}`);
  }
  return res;
}
__name(putObject, "putObject");

// src/lib/rssparse.js
function decodeEntities(s) {
  if (!s) return "";
  return s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#39;/g, "'").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#(\d+);/g, (m, d) => String.fromCodePoint(Number(d))).replace(/&#x([0-9a-f]+);/gi, (m, d) => String.fromCodePoint(parseInt(d, 16)));
}
__name(decodeEntities, "decodeEntities");
function unwrapCdata(s) {
  if (!s) return s;
  s = s.trim();
  const m = s.match(/^<!\[CDATA\[(.+)\]\]>$/s);
  return m ? m[1] : s;
}
__name(unwrapCdata, "unwrapCdata");
function stripTags(s) {
  return s ? String(s).replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim() : "";
}
__name(stripTags, "stripTags");
function grab(html, openTag, closeTag, group = 1) {
  const m = html.match(new RegExp(openTag + "([\\s\\S]*?)" + closeTag, "i"));
  return m ? m[group] || "" : "";
}
__name(grab, "grab");
function attr(html, name) {
  const m = html.match(new RegExp("\\b" + name + `\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  if (!m) return "";
  let val = m[2] || m[3] || m[4] || "";
  return decodeEntities(val).trim();
}
__name(attr, "attr");
function toAbsolute(base, href) {
  if (!href) return "";
  href = decodeEntities(href);
  if (/^https?:\/\//i.test(href)) return href;
  try {
    return new URL(href, base).href;
  } catch (e) {
    return href;
  }
}
__name(toAbsolute, "toAbsolute");
function parseAtom(xml, base) {
  let titleM = xml.match(/<feed[^>]*>[\s\S]*?<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = decodeEntities(unwrapCdata(titleM ? titleM[1] : "")).trim() || "RSS Feed";
  let feedLink = base;
  const linkRe = /<link\b[^>]*\/?>/gi;
  let lm;
  while ((lm = linkRe.exec(xml)) !== null) {
    const l = lm[0];
    const rel = attr(l, "rel");
    const h = attr(l, "href");
    if (rel === "self") continue;
    if (rel === "alternate" || !rel) {
      if (h) {
        feedLink = h;
        break;
      }
    }
  }
  feedLink = toAbsolute(base, feedLink);
  const desc = stripTags(grab(xml, "<feed[^>]*>([\\s\\S]*?)<subtitle", "<"));
  const entries = [];
  const entryRe = /<entry[\s\S]*?<\/entry>/gi;
  let me;
  while ((me = entryRe.exec(xml)) !== null) {
    const en = me[0];
    const eTitle = decodeEntities(unwrapCdata(grab(en, "<title[^>]*>", "<\\/title>"))).trim();
    let eLink = "";
    const elRe = /<link\b[^>]*\/?>/gi;
    let elm;
    while ((elm = elRe.exec(en)) !== null) {
      const h = attr(elm[0], "href");
      if (h) {
        eLink = h;
        break;
      }
    }
    if (!eLink) eLink = decodeEntities(unwrapCdata(grab(en, "<link[^>]*>", "<\\/link>"))).trim();
    eLink = toAbsolute(base, eLink);
    const eId = decodeEntities(unwrapCdata(grab(en, "<id[^>]*>", "<\\/id>"))).trim() || eLink;
    const eUpdated = decodeEntities(unwrapCdata(grab(en, "<updated[^>]*>", "<\\/updated>"))).trim() || decodeEntities(unwrapCdata(grab(en, "<published[^>]*>", "<\\/published>"))).trim();
    let eDesc = decodeEntities(unwrapCdata(grab(en, "<summary[^>]*>", "<\\/summary>"))) || decodeEntities(unwrapCdata(grab(en, "<content[^>]*>", "<\\/content>"))) || "";
    if (eDesc) {
      eDesc = eDesc.replace(/\n/g, "<br>");
    }
    const eAuthor = decodeEntities(unwrapCdata(grab(en, "<author[^>]*>([\\s\\S]*?)<name>([\\s\\S]*?)<\\/name>", "<", 2))).trim() || decodeEntities(unwrapCdata(grab(en, "<author[^>]*>([\\s\\S]*?)<uri>([\\s\\S]*?)<\\/uri>", "<", 2))).trim();
    entries.push({
      title: eTitle || "(\u65E0\u6807\u9898)",
      link: eLink,
      id: eId,
      guid: eId,
      description: eDesc,
      pubDate: eUpdated,
      author: eAuthor
    });
  }
  return { title, link: feedLink, description: desc, items: entries };
}
__name(parseAtom, "parseAtom");
function parseRss(xml, base) {
  const titleM = xml.match(/<channel>[\s\S]*?<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleM ? stripTags(titleM[1]) : "RSS Feed";
  const desc = stripTags(grab(xml, "<channel>([\\s\\S]*?)<description", "<"));
  let channelLink = "";
  const clRe = /<link\b[^>]*>([\s\S]*?)<\/link>/i;
  const clm = xml.match(/<channel>[\s\S]*?<link\b[^>]*>([\s\S]*?)<\/link>/i);
  if (clm) channelLink = decodeEntities(unwrapCdata(clm[1])).trim();
  if (!channelLink) {
    const clSelf = xml.match(/<channel>[\s\S]*?<link\b[^>]*\/?>/i);
    if (clSelf) channelLink = attr(clSelf[0], "href");
  }
  channelLink = toAbsolute(base, channelLink) || base;
  const items = [];
  const itemRe = /<item[\s\S]*?<\/item>/gi;
  let me;
  while ((me = itemRe.exec(xml)) !== null) {
    const it = me[0];
    const iTitle = decodeEntities(unwrapCdata(grab(it, "<title[^>]*>", "<\\/title>"))).trim();
    let iLink = decodeEntities(unwrapCdata(grab(it, "<link[^>]*>([\\s\\S]*?)<\\/link>", "<", 1))).trim();
    if (!iLink) {
      const linkSelf = it.match(/<link\b[^>]*\/>/i);
      if (linkSelf) iLink = attr(linkSelf[0], "href");
    }
    iLink = toAbsolute(base, iLink);
    const iGuid = decodeEntities(unwrapCdata(grab(it, "<guid[^>]*>", "<\\/guid>"))).trim() || decodeEntities(unwrapCdata(grab(it, "<id[^>]*>", "<\\/id>"))).trim() || iLink;
    const iPub = decodeEntities(unwrapCdata(grab(it, "<pubDate[^>]*>", "<\\/pubDate>"))).trim() || decodeEntities(unwrapCdata(grab(it, "<dc:date[^>]*>", "<\\/dc:date>"))).trim();
    let iDesc = decodeEntities(unwrapCdata(grab(it, "<description[^>]*>", "<\\/description>")));
    const iAuthor = decodeEntities(unwrapCdata(grab(it, "<author[^>]*>", "<\\/author>"))).trim() || decodeEntities(unwrapCdata(grab(it, "<dc:creator[^>]*>", "<\\/dc:creator>"))).trim();
    items.push({
      title: iTitle || "(\u65E0\u6807\u9898)",
      link: iLink,
      id: iGuid,
      guid: iGuid,
      description: iDesc,
      pubDate: iPub,
      author: iAuthor
    });
  }
  return { title, link: channelLink, description: desc, items };
}
__name(parseRss, "parseRss");
async function detectAndParse(url, html) {
  const base = url;
  const lower = html.slice(0, 4e3);
  if (/<atom\b|<feed\b/i.test(lower)) return { type: "atom", ...parseAtom(html, base) };
  if (/<rss\b|<rdf:RDF|<rdf\b/i.test(lower)) return { type: "rss", ...parseRss(html, base) };
  return await parseHtmlArticle(url, html);
}
__name(detectAndParse, "detectAndParse");
var NAV_WORDS = /^(about|about-me|contact|contacts|home|index|archives|archive|tags?|tag|category|categories|cat|pages?|search|feed|rss|atom|sitemap|login|log-in|logon|register|signup|sign-in|sign-out|signout|privacy|terms|tos|disclaimer|authors?|author|rss\.xml|feed\.xml)$/i;
function parseHtmlArticle(url, html) {
  const links = [];
  const seen = /* @__PURE__ */ new Set();
  const aRe = /<a\b[^>]*\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>[\s\S]*?<\/a>/gi;
  let m;
  while ((m = aRe.exec(html)) !== null && links.length < 60) {
    let href = m[1] || m[2] || m[3];
    const raw2 = m[0];
    const text = stripTags(raw2);
    if (!href || !text || text.length < 4) continue;
    if (/^(#|javascript:|mailto:|tel:)/i.test(href) || href[0] === "#") continue;
    if (/\.(css|js|ico|png|jpg|jpeg|svg|webp|gif)$/i.test(href)) continue;
    href = toAbsolute(url, href);
    if (seen.has(href)) continue;
    let include = false;
    if (text.length > 80) {
      include = true;
    } else {
      const looksArticle = /\/\d{6,}|\d{4}[-/]\d{1,2}[-/]\d{1,2}|\/p\/|\/a\/|\/article\//i.test(href);
      let path = href;
      try {
        path = new URL(href).pathname;
      } catch (e) {
      }
      const segs = path.split("/").filter(Boolean);
      const last = segs[segs.length - 1] || "";
      const singleSlug = segs.length === 1 && last.length >= 1 && !NAV_WORDS.test(last) && !/\.(html?|php|aspx?)$/i.test(last);
      include = looksArticle || singleSlug;
    }
    if (include) {
      seen.add(href);
      links.push({ title: text.slice(0, 120), link: href, guid: href, description: "", pubDate: "" });
    }
  }
  const titleM = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  let title = titleM ? stripTags(titleM[1]) : url.split("/").pop() || "\u7F51\u9875\u8BA2\u9605";
  if (title.length > 80) title = title.slice(0, 80);
  if (links.length === 0) {
    let body = stripTags(grab(html, "<body[^>]*>", "<\\/body>"));
    if (!body) body = stripTags(html);
    const items = [];
    const chunk = body.slice(0, 4e3);
    const lines = chunk.split(/[。！？\n]{1}/).map((s) => s.trim()).filter((s) => s.length > 20);
    lines.slice(0, 20).forEach((line) => {
      const guid = url + "#t_" + Math.abs(hashCode(line));
      items.push({ title: line.slice(0, 80), link: url, guid, description: line, pubDate: "" });
    });
    return { type: "html", title, link: url, description: "", items };
  }
  return { type: "html", title, link: url, description: "", items: links };
}
__name(parseHtmlArticle, "parseHtmlArticle");
function hashCode(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = h * 31 + s.charCodeAt(i) | 0;
  return h;
}
__name(hashCode, "hashCode");

// src/lib/backup.js
var LAST_BACKUP_KEY = "hotnews:backup:last";
function renderMarkdown(cfg, dateStr, newsByPlatform, rssItems) {
  const lines = [];
  lines.push(`# ${cfg.app.title || "Hot News"} \u6BCF\u65E5\u5907\u4EFD \u2014 ${dateStr}`);
  lines.push("");
  lines.push(`> \u751F\u6210\u65F6\u95F4\uFF1A${nowMinuteStr(cfg.app.timezone)}`);
  lines.push("");
  lines.push("## \u70ED\u699C");
  lines.push("");
  const platformNames = {};
  for (const s of cfg.platforms.sources || []) platformNames[s.id] = s.name;
  for (const [pid, items] of Object.entries(newsByPlatform)) {
    lines.push(`### ${platformNames[pid] || pid}`);
    for (const it of items) {
      lines.push(`${it.rank}. [${it.title}](${it.url || it.mobile_url || ""})`);
    }
    lines.push("");
  }
  lines.push("## RSS \u8BA2\u9605");
  lines.push("");
  for (const it of rssItems) {
    lines.push(`- [${it.title}](${it.url || ""})${it.author ? ` \u2014 ${it.author}` : ""}`);
  }
  lines.push("");
  return lines.join("\n");
}
__name(renderMarkdown, "renderMarkdown");
async function run(env, cfg) {
  const dateStr = todayStr(cfg.app.timezone);
  const last = await readKV(env, LAST_BACKUP_KEY);
  if (last === dateStr) {
    return { ok: true, skipped: true, reason: "\u4ECA\u65E5\u5DF2\u5907\u4EFD" };
  }
  await ensureSchema(env);
  const news = await getNewsByDate(env, dateStr, void 0);
  const rss = await getRssByDate(env, dateStr, void 0);
  const s3 = (() => {
    const c = cfg.storage?.s3 || {};
    return {
      endpoint: c.endpoint || env.S3_ENDPOINT || "",
      bucket: c.bucket || env.S3_BUCKET || "",
      accessKey: c.access_key || "",
      secretKey: c.secret_key || "",
      region: c.region || "auto"
    };
  })();
  if (!s3.endpoint || !s3.bucket || !s3.accessKey || !s3.secretKey) {
    return { ok: false, error: "S3 \u672A\u914D\u7F6E\uFF0C\u65E0\u6CD5\u5907\u4EFD" };
  }
  const prefix = (cfg.backup.path_prefix || "Daily backup").replace(/^\/+|\/+$/g, "");
  const baseKey = `${prefix}/${dateStr}`;
  const full = {
    generated_at: nowMinuteStr(cfg.app.timezone),
    date: dateStr,
    platforms: news,
    rss_items: rss
  };
  const uploaded = [];
  try {
    await putObject({
      endpoint: s3.endpoint,
      bucket: s3.bucket,
      key: `${baseKey}/full.json`,
      body: JSON.stringify(full),
      contentType: "application/json",
      accessKey: s3.accessKey,
      secretKey: s3.secretKey,
      region: s3.region
    });
    uploaded.push(`${baseKey}/full.json`);
    const md = renderMarkdown(cfg, dateStr, news, rss);
    await putObject({
      endpoint: s3.endpoint,
      bucket: s3.bucket,
      key: `${baseKey}/report.md`,
      body: md,
      contentType: "text/markdown",
      accessKey: s3.accessKey,
      secretKey: s3.secretKey,
      region: s3.region
    });
    uploaded.push(`${baseKey}/report.md`);
  } catch (e) {
    return { ok: false, error: e.message, uploaded };
  }
  await writeKV(env, LAST_BACKUP_KEY, dateStr);
  return { ok: true, date: dateStr, uploaded, count: { hotlist: Object.keys(news).length, rss: rss.length } };
}
__name(run, "run");
var backup_default = { run };

// src/lib/pull.js
var RUNNING_KEY = "hotnews:pipeline:running";
var LAST_CRAWL_KEY = "hotnews:hotlist:last";
var DEDUP_PREFIX = "hotnews:dedup:";
var SUBS_KEY = "hotnews:subscriptions";
var ANALYSIS_KEY = "hotnews:analysis:last";
async function getSubscriptions(env) {
  const raw2 = await readKV(env, SUBS_KEY);
  if (!raw2) return [];
  try {
    return JSON.parse(raw2);
  } catch (e) {
    return [];
  }
}
__name(getSubscriptions, "getSubscriptions");
async function saveSubscriptions(env, subs) {
  await writeKV(env, SUBS_KEY, JSON.stringify(subs));
}
__name(saveSubscriptions, "saveSubscriptions");
function isSubDue(sub, clock) {
  if (!sub.pullEnabled) return false;
  const times = Array.isArray(sub.pullTimes) ? sub.pullTimes : [];
  if (times.length === 0) return true;
  if (!times.includes(clock)) return false;
  if (sub.lastPull && Date.now() - sub.lastPull < 8 * 60 * 1e3) return false;
  return true;
}
__name(isSubDue, "isSubDue");
async function fetchSub(env, sub, cfg) {
  if (sub.kind === "platform") {
    const pid = sub.platformId || String(sub.url || "").replace(/^\/rss\/hot\//, "").replace(/\.xml$/i, "");
    if (!pid) throw new Error("\u5E73\u53F0\u8BA2\u9605\u7F3A\u5C11\u5E73\u53F0 ID");
    const date = todayStr(cfg.app.timezone);
    const news = await getNewsByDate(env, date, [pid]);
    const items = (news[pid] || []).slice(0, 30).map((it) => ({
      id: it.url || it.title,
      guid: it.url || it.mobile_url || it.title,
      title: it.title,
      link: it.url || "",
      description: it.title,
      pubDate: it.date ? (/* @__PURE__ */ new Date(it.date + "T00:00:00Z")).toUTCString() : (/* @__PURE__ */ new Date()).toUTCString()
    }));
    return { items };
  }
  const target = sub.sourceUrl || sub.param;
  if (!target || !/^https?:\/\//i.test(target)) throw new Error("\u8BA2\u9605\u6E90 URL \u672A\u914D\u7F6E");
  const text = await fetchText(target, {
    headers: { "User-Agent": DEFAULT_UA, Accept: "application/rss+xml, application/atom+xml, application/xml, text/html,*/*;q=0.8" }
  });
  return detectAndParse(target, text);
}
__name(fetchSub, "fetchSub");
async function dedup(env, key, items) {
  const raw2 = await readKV(env, DEDUP_PREFIX + key);
  const seen = raw2 ? new Set(JSON.parse(raw2)) : /* @__PURE__ */ new Set();
  const fresh = [];
  for (const it of items) {
    const g = it.guid || it.link || it.id;
    if (!g) continue;
    if (!seen.has(g)) {
      seen.add(g);
      fresh.push(it);
    }
  }
  const arr = Array.from(seen);
  const capped = arr.slice(Math.max(0, arr.length - 800));
  await writeKV(env, DEDUP_PREFIX + key, JSON.stringify(capped));
  return fresh;
}
__name(dedup, "dedup");
async function storageCfg(env, cfg) {
  const s3 = cfg.storage?.s3 || {};
  return {
    endpoint: s3.endpoint || env.S3_ENDPOINT || "",
    bucket: s3.bucket || env.S3_BUCKET || "",
    accessKey: s3.access_key || "",
    secretKey: s3.secret_key || "",
    region: s3.region || env.S3_REGION || "auto",
    pathPrefix: s3.path_prefix || env.S3_PATH_PREFIX || "hot-news"
  };
}
__name(storageCfg, "storageCfg");
async function archiveToS3(env, cfg, kind, payload) {
  try {
    const s3 = await storageCfg(env, cfg);
    if (!s3.endpoint || !s3.bucket || !s3.accessKey || !s3.secretKey) return null;
    const key = `${s3.pathPrefix}/raw/${kind}/${todayStr(cfg.app.timezone)}-${Date.now()}.json`;
    await putObject({
      endpoint: s3.endpoint,
      bucket: s3.bucket,
      key,
      body: JSON.stringify(payload),
      contentType: "application/json",
      accessKey: s3.accessKey,
      secretKey: s3.secretKey,
      region: s3.region
    });
    return key;
  } catch (e) {
    return null;
  }
}
__name(archiveToS3, "archiveToS3");
async function aiAnalyze(cfg, env, hotItems, rssItems) {
  const acfg = cfg.ai_analysis || {};
  const pool = [];
  for (const it of hotItems.slice(0, acfg.max_news_for_analysis || 100)) pool.push(`[${it.platform_id}] ${it.title}`);
  if (acfg.include_rss) for (const it of (rssItems || []).slice(0, 50)) pool.push(`[RSS] ${it.title}`);
  if (pool.length === 0) return null;
  const prompt = `\u8BF7\u7528${acfg.language || "\u4E2D\u6587"}\u5BF9\u4ECA\u65E5\u70ED\u70B9\u65B0\u95FB\u8FDB\u884C\u7B80\u77ED\u5206\u6790\uFF0C\u6307\u51FA\u4E3B\u8981\u8D8B\u52BF\u3001\u5171\u540C\u4E3B\u9898\u548C\u503C\u5F97\u5173\u6CE8\u7684\u91CD\u70B9\uFF0C\u63A7\u5236\u5728 400 \u5B57\u4EE5\u5185\u3002
\u4ECA\u65E5\u65B0\u95FB\uFF1A
${pool.join("\n")}`;
  return await chat(cfg, env, [
    { role: "system", content: "\u4F60\u662F\u8D44\u6DF1\u7684\u65B0\u95FB\u5206\u6790\u5E08\u3002" },
    { role: "user", content: prompt }
  ], { max_tokens: 1500 });
}
__name(aiAnalyze, "aiAnalyze");
async function runPipeline(env, { trigger = "cron" } = {}) {
  const running = await readKV(env, RUNNING_KEY);
  if (running === "1") return { ok: true, running: true, message: "\u6D41\u6C34\u7EBF\u5DF2\u5728\u8FD0\u884C" };
  await writeKV(env, RUNNING_KEY, "1", 1800);
  try {
    const cfg = await getConfig(env);
    const tz = cfg.app.timezone || "Asia/Shanghai";
    const today = todayStr(tz);
    const clock = nowClock(tz);
    const nowTs = Date.now();
    const results = { hotlist: null, rssNew: [], subNew: [], matched: [], analysis: null, push: [], errors: [] };
    await ensureSchema(env);
    if (cfg.platforms.enabled) {
      const interval = (cfg.platforms.interval_minutes || 60) * 60 * 1e3;
      const lastRaw = await readKV(env, LAST_CRAWL_KEY);
      const last = lastRaw ? Number(lastRaw) : 0;
      const due = trigger === "manual" || nowTs - last >= interval;
      if (due) {
        const { byPlatform, failed } = await crawlHotlist(cfg, env);
        results.hotlist = { byPlatform, failed };
        const flat = [];
        for (const [pid, pdata] of Object.entries(byPlatform)) {
          for (const it of pdata.items) flat.push({ ...it, platform_id: pid });
        }
        if (flat.length) {
          await upsertNewsItems(env, flat, today);
          await recordRanks(env, flat, today);
        }
        for (const f of failed) results.errors.push(`\u70ED\u699C[${f.alias}] ${f.error}`);
        await writeKV(env, LAST_CRAWL_KEY, String(nowTs));
        await recordCrawl(env, "hotlist", flat.length, JSON.stringify(failed).slice(0, 500));
        if (cfg.storage.raw_archive) {
          const k = await archiveToS3(env, cfg, "hotlist", { time: nowMinuteStr(tz), byPlatform, failed });
          results.hotlistArchive = k;
        }
      }
    }
    const rssNewItems = [];
    if (cfg.rss.enabled && Array.isArray(cfg.rss.feeds)) {
      for (const feed of cfg.rss.feeds) {
        if (feed.enabled === false) continue;
        try {
          if (feed.type === "platform") {
            const pid = String(feed.url || "").replace(/^\/rss\/hot\//, "").replace(/\.xml$/i, "");
            if (!pid) throw new Error("\u5E73\u53F0 feed \u7F3A\u5C11\u5E73\u53F0 ID");
            const pnews = await getNewsByDate(env, today, [pid]);
            const pitems = (pnews[pid] || []).slice(0, 30).map((it) => ({
              id: it.url || it.title,
              guid: it.url || it.mobile_url || it.title,
              title: it.title,
              link: it.url || "",
              description: it.title,
              feed_id: feed.id,
              feed_name: feed.name,
              summary: it.title || ""
            }));
            const pNew = await dedup(env, "rss:" + feed.id, pitems);
            rssNewItems.push(...pNew.map((it) => ({ ...it, source_kind: "rss" })));
            await upsertRssItems(env, pitems.map((it) => ({ ...it, title: it.title || "(\u65E0\u6807\u9898)" })), today);
            await updateRssFeedStatus(env, feed.id, "success", pitems.length);
            continue;
          }
          const text = await fetchText(feed.url, {
            headers: { "User-Agent": DEFAULT_UA, Accept: "application/rss+xml, application/atom+xml, application/xml, text/html,*/*;q=0.8" }
          });
          const parsed = await detectAndParse(feed.url, text);
          const items = (parsed.items || []).slice(0, 30).map((it) => ({
            ...it,
            feed_id: feed.id,
            feed_name: feed.name,
            summary: it.description || ""
          }));
          const freshForPush = items.filter((it) => {
            if (!cfg.rss.max_age_days) return true;
            if (!it.pubDate) return true;
            const d = new Date(it.pubDate).getTime();
            if (isNaN(d)) return true;
            return nowTs - d < cfg.rss.max_age_days * 24 * 3600 * 1e3;
          });
          const newItems = await dedup(env, "rss:" + feed.id, freshForPush);
          rssNewItems.push(...newItems.map((it) => ({ ...it, source_kind: "rss" })));
          await upsertRssItems(env, items.map((it) => ({ ...it, title: it.title || "(\u65E0\u6807\u9898)" })), today);
          await updateRssFeedStatus(env, feed.id, "success", items.length);
        } catch (e) {
          results.errors.push(`RSS[${feed.id}] ${e.message}`);
          await updateRssFeedStatus(env, feed.id, "failed", 0);
        }
      }
    }
    results.rssNew = rssNewItems;
    const subs = await getSubscriptions(env);
    const subNewItems = [];
    for (const sub of subs) {
      if (trigger === "manual") {
        if (!sub.pullEnabled) continue;
      } else {
        if (!isSubDue(sub, clock)) continue;
      }
      try {
        const parsed = await fetchSub(env, sub, cfg);
        const items = (parsed.items || []).slice(0, 30).map((it) => ({ ...it, feed_id: sub.id, feed_name: sub.title || sub.name, summary: it.description || "" }));
        const newItems = await dedup(env, "sub:" + sub.id, items);
        subNewItems.push(...newItems.map((it) => ({ ...it, source_kind: "sub" })));
        await upsertRssItems(env, items.map((it) => ({ ...it, title: it.title || "(\u65E0\u6807\u9898)" })), today);
        sub.lastPull = Date.now();
      } catch (e) {
        results.errors.push(`\u8BA2\u9605[${sub.title || sub.id}] ${e.message}`);
      }
    }
    if (subs.some((s) => s.lastPull)) await saveSubscriptions(env, subs);
    results.subNew = subNewItems;
    const platformIds = (cfg.platforms.sources || []).map((s) => s.id);
    const todayNews = await getNewsByDate(env, today, platformIds);
    const todayRss = await getRssByDate(env, today, void 0);
    let hotCandidates = [];
    if (results.hotlist) {
      const flat = [];
      for (const [pid, pdata] of Object.entries(results.hotlist.byPlatform || {})) {
        for (const it of pdata.items) flat.push({ ...it, platform_id: pid, platform_name: pdata.alias });
      }
      hotCandidates = flat;
    }
    const flatToday = [];
    for (const [pid, pdata] of Object.entries(todayNews)) {
      for (const it of pdata) flatToday.push({ ...it, platform_id: pid, platform_name: pid });
    }
    const top = dedupeItems(flatToday).slice(0, cfg.report.top_count || 10);
    const rssAlways = subNewItems;
    let matchedHot = [];
    let matchedRss = [];
    if (cfg.filter.method === "ai" && aiAvailable(cfg, env)) {
      const r1 = await filterByAI(cfg, env, hotCandidates, cfg.filter.interests);
      matchedHot = r1.matched || [];
      if (r1.error) results.errors.push(`AI\u7B5B\u9009: ${r1.error}`);
    } else {
      matchedHot = filterByKeywords(hotCandidates, cfg.filter.keywords).matched;
    }
    matchedRss = filterByKeywords(rssNewItems, cfg.filter.keywords).matched;
    let hotGroups = {};
    const topTitles = new Set(top.map((it) => it.title));
    if (cfg.report.display_mode === "platform") {
      for (const m of matchedHot) {
        if (!topTitles.has(m.item.title)) {
          (hotGroups[m.item.platform_name || m.item.platform_id] = hotGroups[m.item.platform_name || m.item.platform_id] || []).push(m.item);
        }
      }
    } else {
      for (const m of matchedHot) {
        if (topTitles.has(m.item.title)) continue;
        const key = m.keyword || m.item.platform_name || m.item.platform_id || "\u5176\u4ED6";
        (hotGroups[key] = hotGroups[key] || []).push(m.item);
      }
    }
    for (const k of Object.keys(hotGroups)) hotGroups[k] = dedupeItems(hotGroups[k]);
    if (!Object.keys(hotGroups).length) hotGroups = null;
    if (cfg.ai_analysis.enabled && aiAvailable(cfg, env)) {
      try {
        const lastAnalysis = await readKV(env, ANALYSIS_KEY);
        if (lastAnalysis !== today) {
          const flatHot = [];
          for (const [pid, pdata] of Object.entries(todayNews)) {
            for (const it of pdata) flatHot.push({ ...it, platform_id: pid });
          }
          results.analysis = await aiAnalyze(cfg, env, flatHot, todayRss);
          if (results.analysis) await writeKV(env, ANALYSIS_KEY, today);
        }
      } catch (e) {
        results.errors.push(`AI\u5206\u6790: ${e.message}`);
      }
    }
    const hasTop = top.length > 0;
    const hasHot = matchedHot.length > 0;
    const hasRss = matchedRss.length > 0;
    const hasAlways = rssAlways.length > 0;
    if (hasTop || hasHot || hasRss || hasAlways || cfg.ai_analysis.enabled && results.analysis) {
      const data = {
        title: cfg.app.title || "Hot News \u70ED\u70B9\u901F\u9012",
        timeStr: nowMinuteStr(tz),
        top,
        topCount: cfg.report.top_count || 10,
        hotlist: hotGroups ? { groups: hotGroups, mode: cfg.report.display_mode } : void 0,
        rss: matchedRss.map((m) => m.item),
        rssAlways,
        analysis: results.analysis
      };
      const parts = renderParts(cfg, data);
      results.push = [];
      for (const part of parts) {
        const pr = await push_default.push(env, cfg, part.text);
        results.push.push(...pr);
      }
      results.partsCount = parts.length;
      results.totalItems = parts.reduce((s, p) => s + (p.itemsCount || 0), 0);
      try {
        await env.DB.prepare("INSERT INTO push_records (date, push_time, item_count, mode) VALUES (?, ?, ?, ?)").bind(today, (/* @__PURE__ */ new Date()).toISOString(), top.length + matchedHot.length + matchedRss.length + rssAlways.length, cfg.report.mode).run();
      } catch (e) {
      }
    }
    const dailyCfg = cfg.report.daily || {};
    const weeklyCfg = cfg.report.weekly || {};
    const wkday = new Date(localToTs(todayStr(tz) + " 12:00", tz)).getUTCDay();
    if (dailyCfg.enabled && clock === (dailyCfg.time || "21:00")) {
      const r = await buildAndPushScheduled(env, cfg, { days: 1, title: "\u70ED\u70B9\u65E5\u62A5", withAnalysis: true });
      results.dailyReport = r;
    }
    if (weeklyCfg.enabled && wkday === (weeklyCfg.day === 7 ? 0 : weeklyCfg.day) && clock === (weeklyCfg.time || "20:00")) {
      const r = await buildAndPushScheduled(env, cfg, { days: 7, title: "\u70ED\u70B9\u5468\u62A5", withAnalysis: true });
      results.weeklyReport = r;
    }
    await purgeOldData(env, cfg.retention.news_days || 30);
    if (cfg.backup.enabled) {
      const want = (cfg.backup.time || "23:30").trim();
      if (clock === want || trigger === "manual") {
        const bk = await backup_default.run(env, cfg);
        results.backup = bk;
      }
    }
    results.ok = true;
    await recordCrawl(env, "all", matchedHot.length + matchedRss.length, JSON.stringify({ errors: results.errors.slice(0, 10) }));
    return results;
  } catch (e) {
    console.error("pipeline \u5931\u8D25", e);
    return { ok: false, error: e.message };
  } finally {
    await writeKV(env, RUNNING_KEY, "0");
  }
}
__name(runPipeline, "runPipeline");
async function pushNow(env) {
  const cfg = await getConfig(env);
  const tz = cfg.app.timezone || "Asia/Shanghai";
  const today = todayStr(tz);
  const results = { ok: true, push: [], errors: [] };
  await ensureSchema(env);
  const platformIds = (cfg.platforms.sources || []).map((s) => s.id);
  const todayNews = await getNewsByDate(env, today, platformIds);
  const todayRss = await getRssByDate(env, today, void 0);
  const hotCandidates = [];
  for (const [pid, pdata] of Object.entries(todayNews)) {
    for (const it of pdata) hotCandidates.push({ ...it, platform_id: pid, platform_name: pid });
  }
  const top = dedupeItems(hotCandidates).slice(0, cfg.report.top_count || 10);
  const rssCandidates = todayRss;
  let matchedHot = [];
  let matchedRss = [];
  if (cfg.filter.method === "ai" && aiAvailable(cfg, env)) {
    const r1 = await filterByAI(cfg, env, hotCandidates, cfg.filter.interests);
    matchedHot = r1.matched || [];
    if (r1.error) results.errors.push(`AI\u7B5B\u9009: ${r1.error}`);
  } else {
    matchedHot = filterByKeywords(hotCandidates, cfg.filter.keywords).matched;
  }
  matchedRss = filterByKeywords(rssCandidates, cfg.filter.keywords).matched;
  const topTitlesNow = new Set(top.map((it) => it.title));
  let hotGroupsNow = {};
  if (cfg.report.display_mode === "platform") {
    for (const m of matchedHot) {
      if (!topTitlesNow.has(m.item.title)) {
        (hotGroupsNow[m.item.platform_name || m.item.platform_id] = hotGroupsNow[m.item.platform_name || m.item.platform_id] || []).push(m.item);
      }
    }
  } else {
    for (const m of matchedHot) {
      if (topTitlesNow.has(m.item.title)) continue;
      const key = m.keyword || m.item.platform_name || m.item.platform_id || "\u5176\u4ED6";
      (hotGroupsNow[key] = hotGroupsNow[key] || []).push(m.item);
    }
  }
  for (const k of Object.keys(hotGroupsNow)) hotGroupsNow[k] = dedupeItems(hotGroupsNow[k]);
  if (!Object.keys(hotGroupsNow).length) hotGroupsNow = null;
  const hasTop = top.length > 0;
  const hasHot = matchedHot.length > 0;
  const hasRss = matchedRss.length > 0;
  const hasAlways = todayRss.some((it) => it.source_kind === "sub") && todayRss.filter((it) => it.source_kind === "sub").length > 0;
  if (!hasTop && !hasHot && !hasRss && !hasAlways) {
    results.message = "\u4ECA\u65E5\u6682\u65E0\u5339\u914D\u5185\u5BB9\uFF0C\u672A\u63A8\u9001";
    return results;
  }
  const data = {
    title: cfg.app.title || "Hot News \u70ED\u70B9\u901F\u9012",
    timeStr: nowMinuteStr(tz),
    top,
    topCount: cfg.report.top_count || 10,
    hotlist: hotGroupsNow ? { groups: hotGroupsNow, mode: cfg.report.display_mode } : void 0,
    rss: matchedRss.map((m) => m.item),
    rssAlways: todayRss.filter((it) => it.source_kind === "sub")
  };
  const parts = renderParts(cfg, data);
  results.push = [];
  for (const part of parts) {
    const pr = await push_default.push(env, cfg, part.text);
    results.push.push(...pr);
  }
  results.partsCount = parts.length;
  results.textLength = parts.reduce((s, p) => s + p.text.length, 0);
  results.itemCount = top.length + matchedHot.length + matchedRss.length;
  try {
    await env.DB.prepare("INSERT INTO push_records (date, push_time, item_count, mode) VALUES (?, ?, ?, ?)").bind(today, (/* @__PURE__ */ new Date()).toISOString(), top.length + matchedHot.length + matchedRss.length, "manual-push").run();
  } catch (e) {
  }
  return results;
}
__name(pushNow, "pushNow");
async function buildAndPushScheduled(env, cfg, { days, title, withAnalysis }) {
  const tz = cfg.app.timezone || "Asia/Shanghai";
  const platformIds = (cfg.platforms.sources || []).map((s) => s.id);
  const dates = [];
  for (let i = days - 1; i >= 0; i--) dates.push(isoToDateStr(new Date(Date.now() - i * 864e5).toISOString(), tz));
  const newsByPlatform = {};
  const rssItems = [];
  for (const date of dates) {
    const nb = await getNewsByDate(env, date, platformIds);
    for (const [pid, items] of Object.entries(nb)) (newsByPlatform[pid] = newsByPlatform[pid] || []).push(...items);
    rssItems.push(...await getRssByDate(env, date, void 0));
  }
  const flat = [];
  for (const [pid, items] of Object.entries(newsByPlatform)) {
    for (const it of items) flat.push({ ...it, platform_id: pid, platform_name: pid });
  }
  const top = dedupeItems(flat).slice(0, cfg.report.top_count || 10);
  const matchedHot = filterByKeywords(flat, cfg.filter.keywords).matched;
  const matchedRss = filterByKeywords(rssItems, cfg.filter.keywords).matched;
  const topTitlesWK = new Set(top.map((it) => it.title));
  let hotGroups = {};
  if (cfg.report.display_mode === "platform") {
    for (const m of matchedHot) {
      if (!topTitlesWK.has(m.item.title)) {
        (hotGroups[m.item.platform_name || m.item.platform_id] = hotGroups[m.item.platform_name || m.item.platform_id] || []).push(m.item);
      }
    }
  } else {
    for (const m of matchedHot) {
      if (topTitlesWK.has(m.item.title)) continue;
      const key = m.keyword || m.item.platform_name || m.item.platform_id || "\u5176\u4ED6";
      (hotGroups[key] = hotGroups[key] || []).push(m.item);
    }
  }
  for (const k of Object.keys(hotGroups)) hotGroups[k] = dedupeItems(hotGroups[k]);
  if (!Object.keys(hotGroups).length) hotGroups = null;
  let analysis = null;
  if (withAnalysis && cfg.ai_analysis.enabled && aiAvailable(cfg, env)) {
    try {
      analysis = await aiAnalyze(cfg, env, flat.slice(0, cfg.ai_analysis.max_news_for_analysis || 100), rssItems.slice(0, 50));
    } catch (e) {
    }
  }
  const data = {
    title: `${cfg.app.title || "Hot News"} ${title}`,
    timeStr: nowMinuteStr(tz),
    top,
    topCount: cfg.report.top_count || 10,
    hotlist: hotGroups ? { groups: hotGroups, mode: cfg.report.display_mode } : void 0,
    rss: matchedRss.map((m) => m.item),
    rssAlways: rssItems.filter((it) => it.source_kind === "sub"),
    analysis,
    footnote: days >= 7 ? `${dates[0]} ~ ${dates[dates.length - 1]} \u6570\u636E\u6C47\u603B` : void 0
  };
  const parts = renderParts(cfg, data);
  const pushResults = [];
  for (const part of parts) {
    const pr = await push_default.push(env, cfg, part.text);
    pushResults.push(...pr);
  }
  return { push: pushResults, partsCount: parts.length, textLength: parts.reduce((s, p) => s + p.text.length, 0), itemCount: top.length + matchedHot.length + matchedRss.length };
}
__name(buildAndPushScheduled, "buildAndPushScheduled");
var pull_default = { runPipeline, pushNow, buildAndPushScheduled, getSubscriptions, saveSubscriptions, isSubDue };

// src/lib/html.js
function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
__name(esc, "esc");
function renderDashboard(cfg, data) {
  const tz = cfg.app.timezone || "Asia/Shanghai";
  const today = todayStr(tz);
  const title = cfg.app.title || "Hot News \u70ED\u70B9\u901F\u9012";
  const subs = data.subscriptions || [];
  const feedMeta = {};
  for (const s of subs) {
    feedMeta[s.id] = { name: s.title || s.name, icon: s.icon || "\u{1F517}", isSub: true };
  }
  for (const f of cfg.rss.feeds || []) {
    feedMeta[f.id] = { name: f.name || f.id, icon: f.type === "platform" ? "\u{1F525}" : "\u{1F4F0}", isSub: false };
  }
  const byFeed = {};
  for (const it of data.rssItems || []) {
    const fid = it.feed_id || "";
    if (!fid) continue;
    (byFeed[fid] = byFeed[fid] || []).push(it);
  }
  let subsHtml = "";
  for (const [fid, items] of Object.entries(byFeed)) {
    const meta = feedMeta[fid] || { name: fid, icon: "\u{1F4F0}", isSub: false };
    subsHtml += `<div class="section"><h2>${esc(meta.icon)} ${esc(meta.name)}</h2><ul>`;
    for (const it of items.slice(0, 25)) {
      const link = it.link || it.url || "";
      subsHtml += `<li>`;
      if (link) subsHtml += `<a href="${esc(link)}" target="_blank">`;
      subsHtml += esc(it.title || "(\u65E0\u6807\u9898)");
      if (link) subsHtml += `</a>`;
      if (it.pubDate) subsHtml += ` <span class="tag">${esc(it.pubDate.slice(0, 10))}</span>`;
      if (it.feed_id) subsHtml += ` <span class="tag">${esc(it.feed_id)}</span>`;
      subsHtml += `</li>`;
    }
    subsHtml += "</ul></div>";
  }
  if (!subsHtml) subsHtml = '<div class="section empty">\u6682\u65E0\u8BA2\u9605\u5185\u5BB9\uFF0C\u53BB\u300C\u63A7\u5236\u9762\u677F \u2192 \u81EA\u5B9A\u4E49\u8BA2\u9605\u300D\u6DFB\u52A0\u5427\u3002</div>';
  let pushHtml = "";
  for (const p of data.pushRecords || []) {
    pushHtml += `<li>${esc(p.date)} ${esc(p.push_time)} \u2014 ${p.item_count} \u6761\uFF08${esc(p.mode)}\uFF09</li>`;
  }
  pushHtml = pushHtml ? `<div class="section"><h2>\u63A8\u9001\u8BB0\u5F55</h2><ul>${pushHtml}</ul></div>` : "";
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} \u2014 ${today}</title>
<style>
:root{--fg:#e6e8ee;--muted:#9aa0b0;--accent:#818cf8;--border:rgba(255,255,255,.09)}
*{box-sizing:border-box;margin:0;padding:0}
body{background:
  radial-gradient(1100px 600px at 15% -10%, rgba(99,102,241,.20), transparent 60%),
  radial-gradient(900px 500px at 105% 5%, rgba(168,85,247,.16), transparent 55%),
  radial-gradient(900px 700px at 50% 120%, rgba(34,211,238,.10), transparent 60%),
  #0a0c12;color:var(--fg);font-family:-apple-system,"Segoe UI",Roboto,"PingFang SC","Microsoft YaHei",sans-serif;line-height:1.6;min-height:100vh}
header{position:sticky;top:0;background:rgba(10,12,18,.55);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);border-bottom:1px solid var(--border);padding:14px 20px;display:flex;align-items:center;justify-content:space-between;gap:12px}
header h1{font-size:17px;font-weight:600;background:linear-gradient(90deg,#a5b4fc,#e0e7ff);-webkit-background-clip:text;background-clip:text;color:transparent}
header .date{color:var(--muted);font-size:13px}
header .ops a{color:var(--accent);text-decoration:none;font-size:13px;margin-left:12px}
main{max-width:960px;margin:0 auto;padding:20px;display:flex;flex-direction:column;gap:16px}
.section{background:rgba(24,28,38,.5);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border:1px solid var(--border);border-radius:16px;padding:16px;box-shadow:0 10px 30px rgba(0,0,0,.35);transition:transform .15s ease,border-color .15s ease}
.section:hover{border-color:rgba(129,140,248,.35);transform:translateY(-2px)}
.section h2{font-size:13px;color:var(--muted);margin-bottom:10px;font-weight:600;letter-spacing:.5px;display:flex;align-items:center;gap:6px}
.section ul{list-style:none}
.section li{padding:7px 0;border-bottom:1px solid rgba(255,255,255,.05);font-size:14px;display:flex;gap:8px;align-items:baseline}
.section li:last-child{border-bottom:none}
.section a{color:var(--fg);text-decoration:none}
.section a:hover{color:var(--accent)}
.tag{color:var(--muted);font-size:11px;background:rgba(255,255,255,.07);border-radius:4px;padding:1px 6px}
.empty{color:var(--muted);text-align:center;padding:30px}
footer{padding:24px;text-align:center;color:var(--muted);font-size:12px}
#theme-btn{background:rgba(255,255,255,.05);border:1px solid var(--border);color:var(--muted);border-radius:8px;padding:4px 10px;font-size:13px;cursor:pointer}
#theme-btn:hover{color:var(--fg)}
@media (max-width:720px){main{padding:12px}}
html[data-theme="light"] body{background:
  radial-gradient(1100px 600px at 15% -10%, rgba(99,102,241,.14), transparent 60%),
  radial-gradient(900px 500px at 105% 5%, rgba(168,85,247,.12), transparent 55%),
  #f4f6fb;color:#1a1c23}
html[data-theme="light"] header{background:rgba(255,255,255,.7);border-bottom-color:rgba(0,0,0,.08)}
html[data-theme="light"] header h1{background:linear-gradient(90deg,#4f46e5,#7c3aed);-webkit-background-clip:text;background-clip:text}
html[data-theme="light"] .section{background:rgba(255,255,255,.75);border-color:rgba(0,0,0,.08);box-shadow:0 8px 24px rgba(15,23,42,.08)}
html[data-theme="light"] .section:hover{border-color:rgba(79,70,229,.4)}
html[data-theme="light"] .section li{border-bottom-color:rgba(0,0,0,.06)}
html[data-theme="light"] .section a{color:#1a1c23}
html[data-theme="light"] .section a:hover{color:#4f46e5}
html[data-theme="light"] .tag{background:rgba(0,0,0,.05);color:#5b6472}
html[data-theme="light"] footer{color:#5b6472}
</style>
</head>
<body>
<header>
  <h1>${esc(title)}</h1>
  <div style="display:flex;align-items:center;gap:14px">
    <span class="date">${today}</span>
    <span class="ops"><a href="/help">\u5E2E\u52A9</a><a href="/setting">\u63A7\u5236\u9762\u677F</a><a href="/rss">RSS \u8BA2\u9605</a></span>
    <button id="theme-btn" type="button">\u2600\uFE0F</button>
  </div>
</header>
<main>${subsHtml}${pushHtml}</main>
<footer>hot-news \xB7 \u6570\u636E\u6BCF\u8F6E\u5B9A\u65F6\u6293\u53D6 \xB7 <a href="/setting/api/status" style="color:var(--muted)">\u72B6\u6001</a></footer>
<script>
(function () {
  var btn = document.getElementById('theme-btn');
  if (!btn) return;
  function applyTheme(t) {
    document.documentElement.dataset.theme = t;
    btn.textContent = t === 'light' ? '\u{1F319}' : '\u2600\uFE0F';
    try { localStorage.setItem('hotnews_theme', t); } catch (e) {}
  }
  var saved = 'dark';
  try { saved = localStorage.getItem('hotnews_theme') || 'dark'; } catch (e) {}
  btn.addEventListener('click', function () {
    applyTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');
  });
  applyTheme(saved);
})();
<\/script>
</body>
</html>`;
}
__name(renderDashboard, "renderDashboard");

// node_modules/mustache/mustache.mjs
var objectToString = Object.prototype.toString;
var isArray = Array.isArray || /* @__PURE__ */ __name(function isArrayPolyfill(object) {
  return objectToString.call(object) === "[object Array]";
}, "isArrayPolyfill");
function isFunction(object) {
  return typeof object === "function";
}
__name(isFunction, "isFunction");
function typeStr(obj) {
  return isArray(obj) ? "array" : typeof obj;
}
__name(typeStr, "typeStr");
function escapeRegExp(string) {
  return string.replace(/[\-\[\]{}()*+?.,\\\^$|#\s]/g, "\\$&");
}
__name(escapeRegExp, "escapeRegExp");
function hasProperty(obj, propName) {
  return obj != null && typeof obj === "object" && propName in obj;
}
__name(hasProperty, "hasProperty");
function primitiveHasOwnProperty(primitive, propName) {
  return primitive != null && typeof primitive !== "object" && primitive.hasOwnProperty && primitive.hasOwnProperty(propName);
}
__name(primitiveHasOwnProperty, "primitiveHasOwnProperty");
var regExpTest = RegExp.prototype.test;
function testRegExp(re, string) {
  return regExpTest.call(re, string);
}
__name(testRegExp, "testRegExp");
var nonSpaceRe = /\S/;
function isWhitespace(string) {
  return !testRegExp(nonSpaceRe, string);
}
__name(isWhitespace, "isWhitespace");
var entityMap = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
  "/": "&#x2F;",
  "`": "&#x60;",
  "=": "&#x3D;"
};
function escapeHtml2(string) {
  return String(string).replace(/[&<>"'`=\/]/g, /* @__PURE__ */ __name(function fromEntityMap(s) {
    return entityMap[s];
  }, "fromEntityMap"));
}
__name(escapeHtml2, "escapeHtml");
var whiteRe = /\s*/;
var spaceRe = /\s+/;
var equalsRe = /\s*=/;
var curlyRe = /\s*\}/;
var tagRe = /#|\^|\/|>|\{|&|=|!/;
function parseTemplate(template, tags) {
  if (!template)
    return [];
  var lineHasNonSpace = false;
  var sections = [];
  var tokens = [];
  var spaces = [];
  var hasTag = false;
  var nonSpace = false;
  var indentation = "";
  var tagIndex = 0;
  function stripSpace() {
    if (hasTag && !nonSpace) {
      while (spaces.length)
        delete tokens[spaces.pop()];
    } else {
      spaces = [];
    }
    hasTag = false;
    nonSpace = false;
  }
  __name(stripSpace, "stripSpace");
  var openingTagRe, closingTagRe, closingCurlyRe;
  function compileTags(tagsToCompile) {
    if (typeof tagsToCompile === "string")
      tagsToCompile = tagsToCompile.split(spaceRe, 2);
    if (!isArray(tagsToCompile) || tagsToCompile.length !== 2)
      throw new Error("Invalid tags: " + tagsToCompile);
    openingTagRe = new RegExp(escapeRegExp(tagsToCompile[0]) + "\\s*");
    closingTagRe = new RegExp("\\s*" + escapeRegExp(tagsToCompile[1]));
    closingCurlyRe = new RegExp("\\s*" + escapeRegExp("}" + tagsToCompile[1]));
  }
  __name(compileTags, "compileTags");
  compileTags(tags || mustache.tags);
  var scanner = new Scanner(template);
  var start, type, value, chr, token, openSection;
  while (!scanner.eos()) {
    start = scanner.pos;
    value = scanner.scanUntil(openingTagRe);
    if (value) {
      for (var i = 0, valueLength = value.length; i < valueLength; ++i) {
        chr = value.charAt(i);
        if (isWhitespace(chr)) {
          spaces.push(tokens.length);
          indentation += chr;
        } else {
          nonSpace = true;
          lineHasNonSpace = true;
          indentation += " ";
        }
        tokens.push(["text", chr, start, start + 1]);
        start += 1;
        if (chr === "\n") {
          stripSpace();
          indentation = "";
          tagIndex = 0;
          lineHasNonSpace = false;
        }
      }
    }
    if (!scanner.scan(openingTagRe))
      break;
    hasTag = true;
    type = scanner.scan(tagRe) || "name";
    scanner.scan(whiteRe);
    if (type === "=") {
      value = scanner.scanUntil(equalsRe);
      scanner.scan(equalsRe);
      scanner.scanUntil(closingTagRe);
    } else if (type === "{") {
      value = scanner.scanUntil(closingCurlyRe);
      scanner.scan(curlyRe);
      scanner.scanUntil(closingTagRe);
      type = "&";
    } else {
      value = scanner.scanUntil(closingTagRe);
    }
    if (!scanner.scan(closingTagRe))
      throw new Error("Unclosed tag at " + scanner.pos);
    if (type == ">") {
      token = [type, value, start, scanner.pos, indentation, tagIndex, lineHasNonSpace];
    } else {
      token = [type, value, start, scanner.pos];
    }
    tagIndex++;
    tokens.push(token);
    if (type === "#" || type === "^") {
      sections.push(token);
    } else if (type === "/") {
      openSection = sections.pop();
      if (!openSection)
        throw new Error('Unopened section "' + value + '" at ' + start);
      if (openSection[1] !== value)
        throw new Error('Unclosed section "' + openSection[1] + '" at ' + start);
    } else if (type === "name" || type === "{" || type === "&") {
      nonSpace = true;
    } else if (type === "=") {
      compileTags(value);
    }
  }
  stripSpace();
  openSection = sections.pop();
  if (openSection)
    throw new Error('Unclosed section "' + openSection[1] + '" at ' + scanner.pos);
  return nestTokens(squashTokens(tokens));
}
__name(parseTemplate, "parseTemplate");
function squashTokens(tokens) {
  var squashedTokens = [];
  var token, lastToken;
  for (var i = 0, numTokens = tokens.length; i < numTokens; ++i) {
    token = tokens[i];
    if (token) {
      if (token[0] === "text" && lastToken && lastToken[0] === "text") {
        lastToken[1] += token[1];
        lastToken[3] = token[3];
      } else {
        squashedTokens.push(token);
        lastToken = token;
      }
    }
  }
  return squashedTokens;
}
__name(squashTokens, "squashTokens");
function nestTokens(tokens) {
  var nestedTokens = [];
  var collector = nestedTokens;
  var sections = [];
  var token, section;
  for (var i = 0, numTokens = tokens.length; i < numTokens; ++i) {
    token = tokens[i];
    switch (token[0]) {
      case "#":
      case "^":
        collector.push(token);
        sections.push(token);
        collector = token[4] = [];
        break;
      case "/":
        section = sections.pop();
        section[5] = token[2];
        collector = sections.length > 0 ? sections[sections.length - 1][4] : nestedTokens;
        break;
      default:
        collector.push(token);
    }
  }
  return nestedTokens;
}
__name(nestTokens, "nestTokens");
function Scanner(string) {
  this.string = string;
  this.tail = string;
  this.pos = 0;
}
__name(Scanner, "Scanner");
Scanner.prototype.eos = /* @__PURE__ */ __name(function eos() {
  return this.tail === "";
}, "eos");
Scanner.prototype.scan = /* @__PURE__ */ __name(function scan(re) {
  var match2 = this.tail.match(re);
  if (!match2 || match2.index !== 0)
    return "";
  var string = match2[0];
  this.tail = this.tail.substring(string.length);
  this.pos += string.length;
  return string;
}, "scan");
Scanner.prototype.scanUntil = /* @__PURE__ */ __name(function scanUntil(re) {
  var index = this.tail.search(re), match2;
  switch (index) {
    case -1:
      match2 = this.tail;
      this.tail = "";
      break;
    case 0:
      match2 = "";
      break;
    default:
      match2 = this.tail.substring(0, index);
      this.tail = this.tail.substring(index);
  }
  this.pos += match2.length;
  return match2;
}, "scanUntil");
function Context2(view, parentContext) {
  this.view = view;
  this.cache = { ".": this.view };
  this.parent = parentContext;
}
__name(Context2, "Context");
Context2.prototype.push = /* @__PURE__ */ __name(function push2(view) {
  return new Context2(view, this);
}, "push");
Context2.prototype.lookup = /* @__PURE__ */ __name(function lookup(name) {
  var cache = this.cache;
  var value;
  if (cache.hasOwnProperty(name)) {
    value = cache[name];
  } else {
    var context = this, intermediateValue, names, index, lookupHit = false;
    while (context) {
      if (name.indexOf(".") > 0) {
        intermediateValue = context.view;
        names = name.split(".");
        index = 0;
        while (intermediateValue != null && index < names.length) {
          if (index === names.length - 1)
            lookupHit = hasProperty(intermediateValue, names[index]) || primitiveHasOwnProperty(intermediateValue, names[index]);
          intermediateValue = intermediateValue[names[index++]];
        }
      } else {
        intermediateValue = context.view[name];
        lookupHit = hasProperty(context.view, name);
      }
      if (lookupHit) {
        value = intermediateValue;
        break;
      }
      context = context.parent;
    }
    cache[name] = value;
  }
  if (isFunction(value))
    value = value.call(this.view);
  return value;
}, "lookup");
function Writer() {
  this.templateCache = {
    _cache: {},
    set: /* @__PURE__ */ __name(function set(key, value) {
      this._cache[key] = value;
    }, "set"),
    get: /* @__PURE__ */ __name(function get(key) {
      return this._cache[key];
    }, "get"),
    clear: /* @__PURE__ */ __name(function clear() {
      this._cache = {};
    }, "clear")
  };
}
__name(Writer, "Writer");
Writer.prototype.clearCache = /* @__PURE__ */ __name(function clearCache() {
  if (typeof this.templateCache !== "undefined") {
    this.templateCache.clear();
  }
}, "clearCache");
Writer.prototype.parse = /* @__PURE__ */ __name(function parse(template, tags) {
  var cache = this.templateCache;
  var cacheKey = template + ":" + (tags || mustache.tags).join(":");
  var isCacheEnabled = typeof cache !== "undefined";
  var tokens = isCacheEnabled ? cache.get(cacheKey) : void 0;
  if (tokens == void 0) {
    tokens = parseTemplate(template, tags);
    isCacheEnabled && cache.set(cacheKey, tokens);
  }
  return tokens;
}, "parse");
Writer.prototype.render = /* @__PURE__ */ __name(function render(template, view, partials, config) {
  var tags = this.getConfigTags(config);
  var tokens = this.parse(template, tags);
  var context = view instanceof Context2 ? view : new Context2(view, void 0);
  return this.renderTokens(tokens, context, partials, template, config);
}, "render");
Writer.prototype.renderTokens = /* @__PURE__ */ __name(function renderTokens(tokens, context, partials, originalTemplate, config) {
  var buffer = "";
  var token, symbol, value;
  for (var i = 0, numTokens = tokens.length; i < numTokens; ++i) {
    value = void 0;
    token = tokens[i];
    symbol = token[0];
    if (symbol === "#") value = this.renderSection(token, context, partials, originalTemplate, config);
    else if (symbol === "^") value = this.renderInverted(token, context, partials, originalTemplate, config);
    else if (symbol === ">") value = this.renderPartial(token, context, partials, config);
    else if (symbol === "&") value = this.unescapedValue(token, context);
    else if (symbol === "name") value = this.escapedValue(token, context, config);
    else if (symbol === "text") value = this.rawValue(token);
    if (value !== void 0)
      buffer += value;
  }
  return buffer;
}, "renderTokens");
Writer.prototype.renderSection = /* @__PURE__ */ __name(function renderSection(token, context, partials, originalTemplate, config) {
  var self = this;
  var buffer = "";
  var value = context.lookup(token[1]);
  function subRender(template) {
    return self.render(template, context, partials, config);
  }
  __name(subRender, "subRender");
  if (!value) return;
  if (isArray(value)) {
    for (var j = 0, valueLength = value.length; j < valueLength; ++j) {
      buffer += this.renderTokens(token[4], context.push(value[j]), partials, originalTemplate, config);
    }
  } else if (typeof value === "object" || typeof value === "string" || typeof value === "number") {
    buffer += this.renderTokens(token[4], context.push(value), partials, originalTemplate, config);
  } else if (isFunction(value)) {
    if (typeof originalTemplate !== "string")
      throw new Error("Cannot use higher-order sections without the original template");
    value = value.call(context.view, originalTemplate.slice(token[3], token[5]), subRender);
    if (value != null)
      buffer += value;
  } else {
    buffer += this.renderTokens(token[4], context, partials, originalTemplate, config);
  }
  return buffer;
}, "renderSection");
Writer.prototype.renderInverted = /* @__PURE__ */ __name(function renderInverted(token, context, partials, originalTemplate, config) {
  var value = context.lookup(token[1]);
  if (!value || isArray(value) && value.length === 0)
    return this.renderTokens(token[4], context, partials, originalTemplate, config);
}, "renderInverted");
Writer.prototype.indentPartial = /* @__PURE__ */ __name(function indentPartial(partial, indentation, lineHasNonSpace) {
  var filteredIndentation = indentation.replace(/[^ \t]/g, "");
  var partialByNl = partial.split("\n");
  for (var i = 0; i < partialByNl.length; i++) {
    if (partialByNl[i].length && (i > 0 || !lineHasNonSpace)) {
      partialByNl[i] = filteredIndentation + partialByNl[i];
    }
  }
  return partialByNl.join("\n");
}, "indentPartial");
Writer.prototype.renderPartial = /* @__PURE__ */ __name(function renderPartial(token, context, partials, config) {
  if (!partials) return;
  var tags = this.getConfigTags(config);
  var value = isFunction(partials) ? partials(token[1]) : partials[token[1]];
  if (value != null) {
    var lineHasNonSpace = token[6];
    var tagIndex = token[5];
    var indentation = token[4];
    var indentedValue = value;
    if (tagIndex == 0 && indentation) {
      indentedValue = this.indentPartial(value, indentation, lineHasNonSpace);
    }
    var tokens = this.parse(indentedValue, tags);
    return this.renderTokens(tokens, context, partials, indentedValue, config);
  }
}, "renderPartial");
Writer.prototype.unescapedValue = /* @__PURE__ */ __name(function unescapedValue(token, context) {
  var value = context.lookup(token[1]);
  if (value != null)
    return value;
}, "unescapedValue");
Writer.prototype.escapedValue = /* @__PURE__ */ __name(function escapedValue(token, context, config) {
  var escape = this.getConfigEscape(config) || mustache.escape;
  var value = context.lookup(token[1]);
  if (value != null)
    return typeof value === "number" && escape === mustache.escape ? String(value) : escape(value);
}, "escapedValue");
Writer.prototype.rawValue = /* @__PURE__ */ __name(function rawValue(token) {
  return token[1];
}, "rawValue");
Writer.prototype.getConfigTags = /* @__PURE__ */ __name(function getConfigTags(config) {
  if (isArray(config)) {
    return config;
  } else if (config && typeof config === "object") {
    return config.tags;
  } else {
    return void 0;
  }
}, "getConfigTags");
Writer.prototype.getConfigEscape = /* @__PURE__ */ __name(function getConfigEscape(config) {
  if (config && typeof config === "object" && !isArray(config)) {
    return config.escape;
  } else {
    return void 0;
  }
}, "getConfigEscape");
var mustache = {
  name: "mustache.js",
  version: "4.2.0",
  tags: ["{{", "}}"],
  clearCache: void 0,
  escape: void 0,
  parse: void 0,
  render: void 0,
  Scanner: void 0,
  Context: void 0,
  Writer: void 0,
  /**
   * Allows a user to override the default caching strategy, by providing an
   * object with set, get and clear methods. This can also be used to disable
   * the cache by setting it to the literal `undefined`.
   */
  set templateCache(cache) {
    defaultWriter.templateCache = cache;
  },
  /**
   * Gets the default or overridden caching object from the default writer.
   */
  get templateCache() {
    return defaultWriter.templateCache;
  }
};
var defaultWriter = new Writer();
mustache.clearCache = /* @__PURE__ */ __name(function clearCache2() {
  return defaultWriter.clearCache();
}, "clearCache");
mustache.parse = /* @__PURE__ */ __name(function parse2(template, tags) {
  return defaultWriter.parse(template, tags);
}, "parse");
mustache.render = /* @__PURE__ */ __name(function render2(template, view, partials, config) {
  if (typeof template !== "string") {
    throw new TypeError('Invalid template! Template should be a "string" but "' + typeStr(template) + '" was given as the first argument for mustache#render(template, view, partials)');
  }
  return defaultWriter.render(template, view, partials, config);
}, "render");
mustache.escape = escapeHtml2;
mustache.Scanner = Scanner;
mustache.Context = Context2;
mustache.Writer = Writer;
var mustache_default = mustache;

// src/lib/rssrender.js
var RSS2_TEMPLATE = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0">
<channel>
  <title><![CDATA[{{{title}}}]]></title>
  <link>{{link}}</link>
  <description>{{description}}</description>
  <language>{{language}}</language>
  <category>{{category}}</category>
  {{#items}}
    <item>
        <title><![CDATA[{{{title}}}]]></title>
        <link>{{link}}</link>
        <description><![CDATA[{{{description}}}]]></description>
        {{#pubDate}}
        <pubDate>{{pubDate}}</pubDate>
        {{/pubDate}}
        {{#guid}}
        <guid>{{guid}}</guid>
        {{/guid}}
        {{#author}}
        <author>{{author}}</author>
        {{/author}}
        {{#category}}
        <category>{{category}}</category>
        {{/category}}
    </item>
  {{/items}}
</channel>
</rss>`;
function renderRss2(data) {
  return mustache_default.render(RSS2_TEMPLATE, {
    ...data,
    language: data.language || "zh-cn",
    category: data.category || "",
    description: data.description || ""
  });
}
__name(renderRss2, "renderRss2");

// src/lib/platforms/bilibili.js
function parseTime(ts) {
  if (!ts) return (/* @__PURE__ */ new Date()).toUTCString();
  const d = new Date(ts * 1e3);
  return isNaN(d.getTime()) ? (/* @__PURE__ */ new Date()).toUTCString() : d.toUTCString();
}
__name(parseTime, "parseTime");
function extractContent(item) {
  const type = item.type || "";
  const modDesc = item.modules?.module_desc?.text || "";
  const major = item.modules?.module_dynamic?.major || {};
  let title = modDesc.trim();
  let desc = modDesc;
  if (major.archive) {
    const a = major.archive;
    const t = (title || a.title || "").trim();
    title = t || "(\u89C6\u9891\u52A8\u6001)";
    desc = (a.desc ? `${t} \u2014 ${a.desc}` : t) + (a.cover ? `<br><img src="${a.cover}">` : "");
  } else if (major.opus) {
    const o = major.opus;
    const t = (title || o.summary && o.summary.text || "").trim();
    title = t || "(\u56FE\u6587\u52A8\u6001)";
    desc = o.summary && o.summary.text || t;
    if (o.pics && o.pics.length) {
      for (const p of o.pics.slice(0, 9)) desc += `<br><img src="${p.url}">`;
    }
  } else if (major.forward) {
    const f = major.forward;
    const origDesc = f.orig_desc && f.orig_desc.text || "";
    const t = (title || "").trim();
    title = t || (origDesc ? origDesc.slice(0, 50) : "(\u8F6C\u53D1\u52A8\u6001)");
    desc = (t ? t + "<br>" : "") + `\u8F6C\u53D1\uFF1A@${f.orig_name || "\u672A\u77E5"}<br>${origDesc}`;
  } else if (major.live_rcmd) {
    const l = major.live_rcmd;
    title = title || l.content && l.content.text || "(\u76F4\u64AD\u52A8\u6001)";
    desc = l.content && l.content.text || title;
  }
  if (!title) title = "(\u52A8\u6001)";
  return { title: title.slice(0, 120), description: desc };
}
__name(extractContent, "extractContent");
async function fetchDynSpace(uid) {
  const url = `https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/space?host_mid=${uid}&timezone_offset=-480&features=itemOpusStyle`;
  const data = await fetchJson(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36",
      Referer: `https://space.bilibili.com/${uid}/dynamic`
    }
  });
  if (data.code !== 0) throw new Error(`B\u7AD9 API \u8FD4\u56DE ${data.code}: ${data.message}`);
  const items = data.data && Array.isArray(data.data.items) ? data.data.items : [];
  const list = [];
  for (const item of items) {
    const author = item.modules?.module_author;
    list.push({
      id: item.id_str,
      type: item.type,
      authorName: author?.name || "",
      pub_ts: author?.pub_ts,
      ...extractContent(item)
    });
  }
  return { list, username: list[0]?.authorName || "" };
}
__name(fetchDynSpace, "fetchDynSpace");
function buildFeed(items, username, uid, kind) {
  const data = {
    title: `${username || uid} \u7684 bilibili ${kind === "video" ? "\u89C6\u9891" : "\u52A8\u6001"}`,
    link: `https://space.bilibili.com/${uid}/dynamic`,
    description: `${username || uid} \u7684 bilibili ${kind === "video" ? "\u89C6\u9891" : "\u52A8\u6001"}`,
    language: "zh-cn",
    items: items.map((it) => ({
      title: it.title,
      link: `https://t.bilibili.com/${it.id}`,
      guid: `https://t.bilibili.com/${it.id}`,
      description: it.description,
      pubDate: parseTime(it.pub_ts),
      author: it.authorName,
      category: it.type
    }))
  };
  return renderRss2(data);
}
__name(buildFeed, "buildFeed");
async function dealDynamic(ctx) {
  const { uid } = ctx.req.param();
  const { list, username } = await fetchDynSpace(uid);
  const xml = buildFeed(list, username, uid, "dynamic");
  ctx.header("Content-Type", "application/xml");
  return ctx.body(xml);
}
__name(dealDynamic, "dealDynamic");
async function dealVideo(ctx) {
  const { uid } = ctx.req.param();
  const { list, username } = await fetchDynSpace(uid);
  const vids = list.filter((it) => String(it.type).includes("AV") || String(it.type).includes("VIDEO"));
  const xml = buildFeed(vids, username, uid, "video");
  ctx.header("Content-Type", "application/xml");
  return ctx.body(xml);
}
__name(dealVideo, "dealVideo");
var setup = /* @__PURE__ */ __name((route2) => {
  route2.get("/bilibili/user/dynamic/:uid", dealDynamic);
  route2.get("/bilibili/user/video/:uid", dealVideo);
}, "setup");
var bilibili_default = { setup };

// src/lib/platforms/douyin.js
function findAwemeList(obj, depth = 0) {
  if (!obj || typeof obj !== "object" || depth > 10) return null;
  if (obj.aweme_list && Array.isArray(obj.aweme_list) && obj.aweme_list.length) return obj.aweme_list;
  for (const key in obj) {
    if (typeof obj[key] === "object" && obj[key] !== null) {
      const r = findAwemeList(obj[key], depth + 1);
      if (r) return r;
    }
  }
  return null;
}
__name(findAwemeList, "findAwemeList");
function findUserInfo(obj, depth = 0) {
  if (!obj || typeof obj !== "object" || depth > 10) return null;
  if (obj.user && (obj.user.nickname || obj.user.sec_uid)) return obj.user;
  if (obj.userInfo && (obj.userInfo.nickname || obj.userInfo.sec_uid)) return obj.userInfo;
  if (obj.author && (obj.author.nickname || obj.author.sec_uid)) return obj.author;
  for (const key in obj) {
    if (typeof obj[key] === "object" && obj[key] !== null) {
      const r = findUserInfo(obj[key], depth + 1);
      if (r) return r;
    }
  }
  return null;
}
__name(findUserInfo, "findUserInfo");
function getCoverUrl(post) {
  return post.video?.cover?.url_list?.pop() || post.video?.origin_cover?.url_list?.pop() || post.aweme_info?.video?.cover?.url_list?.pop() || "";
}
__name(getCoverUrl, "getCoverUrl");
async function deal(ctx) {
  const { uid } = ctx.req.param();
  if (!uid || !uid.startsWith("MS4wLjABAAAA")) {
    throw new Error("\u65E0\u6548\u7684\u6296\u97F3\u7528\u6237ID\u3002sec_uid \u5E94\u4EE5 MS4wLjABAAAA \u5F00\u5934\u3002");
  }
  const pageUrl = `https://www.douyin.com/user/${uid}`;
  const res = await fetchWithTimeout(pageUrl, {
    headers: {
      "User-Agent": DEFAULT_UA,
      Referer: "https://www.douyin.com/",
      Cookie: ctx.env.DOUYIN_COOKIE || "",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8"
    }
  }, 1, 2e4);
  if (!res.ok) throw new Error(`\u8BF7\u6C42\u6296\u97F3\u9875\u9762\u5931\u8D25: HTTP ${res.status}`);
  const html = await res.text();
  let renderDataMatch = html.match(/<script\s+id="RENDER_DATA"[^>]*>([\s\S]*?)<\/script>/);
  if (!renderDataMatch) renderDataMatch = html.match(/<script\s+id="_ROUTER_DATA"[^>]*>([\s\S]*?)<\/script>/);
  let initialStateMatch = null;
  if (!renderDataMatch) initialStateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\})\s*;?\s*<\/script>/);
  let pageData = null;
  if (renderDataMatch) {
    try {
      pageData = JSON.parse(decodeURIComponent(renderDataMatch[1]));
    } catch (e) {
      try {
        pageData = JSON.parse(renderDataMatch[1]);
      } catch (e2) {
        throw new Error("\u89E3\u6790\u6296\u97F3\u9875\u9762\u6570\u636E\u5931\u8D25");
      }
    }
  } else if (initialStateMatch) {
    try {
      pageData = JSON.parse(initialStateMatch[1].replace(/undefined/g, "null"));
    } catch (e) {
      throw new Error("\u89E3\u6790\u6296\u97F3\u521D\u59CB\u72B6\u6001\u6570\u636E\u5931\u8D25");
    }
  }
  if (!pageData) throw new Error("\u65E0\u6CD5\u83B7\u53D6\u6296\u97F3\u6570\u636E\u3002\u53EF\u80FD\u9700\u8981\u914D\u7F6E DOUYIN_COOKIE \u73AF\u5883\u53D8\u91CF\uFF0C\u6216\u7528\u6237ID\u4E0D\u6B63\u786E\u3002");
  const awemeList = findAwemeList(pageData) || [];
  const userInfo = findUserInfo(pageData) || {};
  if (awemeList.length === 0) throw new Error("\u672A\u627E\u5230\u6296\u97F3\u89C6\u9891\u6570\u636E\u3002\u8BE5\u7528\u6237\u53EF\u80FD\u6CA1\u6709\u53D1\u5E03\u89C6\u9891\uFF0C\u6216\u9700\u8981\u914D\u7F6E DOUYIN_COOKIE\u3002");
  const nick = userInfo.nickname || uid;
  const items = awemeList.filter((post) => post && (post.aweme_id || post.desc)).slice(0, 30).map((post) => {
    const awemeId = post.aweme_id || "";
    const desc = post.desc || "\u65E0\u6807\u9898";
    const coverUrl = getCoverUrl(post);
    const createTime = post.create_time;
    const pubDate = createTime ? new Date(createTime * 1e3).toUTCString() : "";
    let descriptionHtml = "";
    if (coverUrl) descriptionHtml += `<img src="${coverUrl}" /><br>`;
    descriptionHtml += `<p>${String(desc).replace(/\n/g, "<br>")}</p>`;
    return {
      title: String(desc).split("\n")[0] || "\u65E0\u6807\u9898",
      link: `https://www.douyin.com/video/${awemeId}`,
      guid: awemeId,
      description: descriptionHtml,
      pubDate,
      author: nick
    };
  });
  const data = {
    title: `${nick} \u7684\u6296\u97F3\u89C6\u9891`,
    link: pageUrl,
    description: `${nick} \u7684\u6296\u97F3\u89C6\u9891`,
    language: "zh-cn",
    items
  };
  ctx.header("Content-Type", "application/xml");
  return ctx.body(renderRss2(data));
}
__name(deal, "deal");
var setup2 = /* @__PURE__ */ __name((route2) => {
  route2.get("/douyin/user/:uid", deal);
}, "setup");
var douyin_default = { setup: setup2 };

// src/lib/platforms/weibo.js
var API_HEADERS = {
  "MWeibo-Pwa": 1,
  "X-Requested-With": "XMLHttpRequest",
  "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 11_0 like Mac OS X) AppleWebKit/604.1.38 (KHTML, like Gecko) Version/11.0 Mobile/15A372 Safari/604.1"
};
function parseWeiboDate(str) {
  if (!str) return (/* @__PURE__ */ new Date()).toUTCString();
  const s = String(str).trim();
  const now = /* @__PURE__ */ new Date();
  let d;
  if (/分钟前/.test(s)) {
    d = new Date(now.getTime() - Number(s.split("\u5206\u949F\u524D")[0]) * 6e4);
  } else if (/小时前/.test(s)) {
    d = new Date(now.getTime() - Number(s.split("\u5C0F\u65F6\u524D")[0]) * 36e5);
  } else if (/今天/.test(s)) {
    const m = s.match(/今天[^\d]*(\d+):(\d+)/);
    d = m ? new Date(now.getFullYear(), now.getMonth(), now.getDate(), Number(m[1]), Number(m[2])) : now;
  } else if (/昨天/.test(s)) {
    const m = s.match(/昨天[^\d]*(\d+):(\d+)/);
    d = m ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, Number(m[1]), Number(m[2])) : now;
  } else {
    const parsed = new Date(s);
    d = isNaN(parsed.getTime()) ? now : parsed;
  }
  return isNaN(d.getTime()) ? (/* @__PURE__ */ new Date()).toUTCString() : d.toUTCString();
}
__name(parseWeiboDate, "parseWeiboDate");
function stripHtml(html) {
  return String(html || "").replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();
}
__name(stripHtml, "stripHtml");
async function getContainer(uid, containerId, cookie) {
  const url = containerId ? `https://m.weibo.cn/api/container/getIndex?type=uid&value=${uid}&containerid=${containerId}` : `https://m.weibo.cn/api/container/getIndex?type=uid&value=${uid}`;
  const res = await fetchWithTimeout(url, {
    headers: { Referer: `https://m.weibo.cn/u/${uid}`, Cookie: cookie || "", Accept: "application/json", ...API_HEADERS }
  }, 1, 15e3);
  if (!res.ok) throw new Error(`\u5FAE\u535A API HTTP ${res.status}`);
  return res.json();
}
__name(getContainer, "getContainer");
async function deal2(ctx) {
  const { uid } = ctx.req.param();
  const cookie = ctx.env.WEIBO_COOKIE || "";
  const first = await getContainer(uid, "", cookie);
  if (first.ok !== 1) throw new Error("\u5FAE\u535A API \u8FD4\u56DE\u5F02\u5E38");
  const userInfo = first.data?.userInfo || {};
  const containerId = (first.data?.tabsInfo?.tabs || []).filter((t) => t.tab_type === "weibo")[0]?.containerid;
  if (!containerId) throw new Error("\u672A\u627E\u5230\u5FAE\u535A tab");
  const cards = await getContainer(uid, containerId, cookie);
  const list = Array.isArray(cards.data?.cards) ? cards.data.cards : [];
  const items = [];
  for (const card of list.slice(0, 30)) {
    const mb = card.mblog;
    if (!mb) continue;
    const title = stripHtml(mb.text);
    if (!title) continue;
    const bid = mb.bid || mb.id;
    items.push({
      title: title.slice(0, 120),
      link: `https://weibo.com/${uid}/${bid}`,
      guid: `https://weibo.com/${uid}/${bid}`,
      description: `<p>${title}</p>`,
      pubDate: parseWeiboDate(mb.created_at),
      author: mb.user?.screen_name || userInfo.screen_name || ""
    });
  }
  const data = {
    title: `${userInfo.screen_name || uid} \u7684\u5FAE\u535A`,
    link: `https://weibo.com/${uid}/`,
    description: userInfo.description || "\u5FAE\u535A\u8BA2\u9605",
    language: "zh-cn",
    items
  };
  ctx.header("Content-Type", "application/xml");
  return ctx.body(renderRss2(data));
}
__name(deal2, "deal");
var setup3 = /* @__PURE__ */ __name((route2) => {
  route2.get("/weibo/user/:uid", deal2);
}, "setup");
var weibo_default = { setup: setup3 };

// src/lib/platforms/xiaohongshu.js
async function getState(url) {
  const res = await fetchWithTimeout(url, {
    headers: { "User-Agent": DEFAULT_UA }
  }, 1, 15e3);
  if (!res.ok) throw new Error(`\u5C0F\u7EA2\u4E66\u9875\u9762 HTTP ${res.status}`);
  const html = await res.text();
  const m = html.match(/window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\})\s*;?\s*<\/script>/);
  if (!m) throw new Error("\u672A\u627E\u5230\u5C0F\u7EA2\u4E66\u9875\u9762\u6570\u636E\uFF08\u53EF\u80FD\u9700\u8981 Cookie\uFF09");
  let script = m[1].replace(/undefined/g, "null");
  return JSON.parse(script);
}
__name(getState, "getState");
async function deal3(ctx) {
  const { uid } = ctx.req.param();
  const url = `https://www.xiaohongshu.com/user/profile/${uid}`;
  const state = await getState(url);
  const userData = state.user || {};
  const pageData = userData.userPageData || {};
  const basicInfo = pageData.basicInfo || {};
  const notes = userData.notes || [];
  let list = [];
  if (Array.isArray(notes)) {
    for (const n of notes) {
      if (Array.isArray(n)) list.push(...n);
      else if (n && n.noteCard) list.push(n);
    }
  }
  const items = list.slice(0, 30).map((entry) => {
    const card = entry.noteCard || entry;
    const noteId = card.noteId || card.note_id || "";
    const title = card.displayTitle || card.display_title || "(\u65E0\u6807\u9898)";
    const cover = card.cover && card.cover.infoList && card.cover.infoList[card.cover.infoList.length - 1]?.url || "";
    const author = card.user?.nickname || "";
    return {
      title,
      link: `${url}/${noteId}`,
      guid: `${url}/${noteId}`,
      description: cover ? `<img src="${cover}"><br>${title}` : title,
      author
    };
  });
  const data = {
    title: `${basicInfo.nickname || uid} \u7684\u7B14\u8BB0`,
    link: url,
    description: basicInfo.desc || "\u5C0F\u7EA2\u4E66\u7B14\u8BB0\u8BA2\u9605",
    language: "zh-cn",
    items
  };
  ctx.header("Content-Type", "application/rss+xml; charset=UTF-8");
  return ctx.body(renderRss2(data));
}
__name(deal3, "deal");
var setup4 = /* @__PURE__ */ __name((route2) => {
  route2.get("/xiaohongshu/user/:uid", deal3);
}, "setup");
var xiaohongshu_default = { setup: setup4 };

// src/lib/platforms/telegram.js
function parseTelegram(html, username) {
  const items = [];
  const re = /<div class="tgme_widget_message_wrap[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/g;
  const blockRe = /<div class="tgme_widget_message"[^>]*data-post="([^"]+)"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/g;
  const textRe = /<div class="tgme_widget_message_text[^>]*>([\s\S]*?)<\/div>/;
  const dateRe = /<time datetime="([^"]+)"/;
  let m;
  while ((m = blockRe.exec(html)) !== null) {
    const dataPost = m[1];
    const block = m[0];
    let text = "";
    const tm = block.match(textRe);
    if (tm) {
      text = tm[1].replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
    }
    let pubDate = "";
    const dm = block.match(dateRe);
    if (dm) pubDate = dm[1];
    items.push({
      title: text ? text.split("\n")[0].slice(0, 100) : "(\u65E0\u5185\u5BB9)",
      link: `https://t.me/${username}/${dataPost}`,
      guid: `https://t.me/${username}/${dataPost}`,
      description: text ? text.replace(/\n/g, "<br>") : "",
      pubDate
    });
  }
  return items;
}
__name(parseTelegram, "parseTelegram");
async function deal4(ctx) {
  const { username } = ctx.req.param();
  const html = await fetchText(`https://t.me/s/${username}`, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36" }
  });
  const items = parseTelegram(html, username);
  const titleM = html.match(/<title>([\s\S]*?)<\/title>/i);
  const title = titleM ? titleM[1].trim() : `@${username}`;
  const data = {
    title: `${title} - Telegram \u9891\u9053`,
    link: `https://t.me/s/${username}`,
    description: `Telegram \u9891\u9053 @${username}`,
    language: "zh-cn",
    items: items.slice(0, 50)
  };
  ctx.header("Content-Type", "application/xml");
  return ctx.body(renderRss2(data));
}
__name(deal4, "deal");
var setup5 = /* @__PURE__ */ __name((route2) => {
  route2.get("/telegram/channel/:username", deal4);
}, "setup");
var telegram_default2 = { setup: setup5 };

// src/lib/platforms/custom.js
async function deal5(ctx) {
  const { id } = ctx.req.param();
  const raw2 = await ctx.env.KV.get("hotnews:subscriptions").catch(() => null);
  let subs = [];
  if (raw2) {
    try {
      subs = JSON.parse(raw2);
    } catch (e) {
    }
  }
  const sub = subs.find((s) => s.id === id);
  let target = null;
  if (sub && sub.sourceUrl) target = sub.sourceUrl;
  else if (sub && sub.param && /^https?:\/\//i.test(sub.param)) target = sub.param;
  if (!target) {
    const qUrl = new URL(ctx.req.url).searchParams.get("url");
    if (qUrl && /^https?:\/\//i.test(qUrl)) target = qUrl;
  }
  if (!target) throw new Error("\u8BA2\u9605\u6E90 URL \u672A\u914D\u7F6E");
  const res = await fetchWithTimeout(target, {
    headers: {
      "User-Agent": DEFAULT_UA,
      Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, text/html;q=0.9,*/*;q=0.8",
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8"
    }
  }, 1, 2e4);
  if (!res.ok) throw new Error(`\u6293\u53D6\u5931\u8D25: HTTP ${res.status}`);
  const html = await res.text();
  const parsed = await detectAndParse(target, html);
  const data = {
    title: parsed.title || sub?.title || "\u81EA\u5B9A\u4E49\u8BA2\u9605",
    link: parsed.link || target,
    description: parsed.description || "\u7531 hot-news \u751F\u6210\u7684\u81EA\u5B9A\u4E49\u8BA2\u9605\u6E90",
    language: "zh-cn",
    items: (parsed.items || []).slice(0, 50).map((it) => ({
      title: stripTags(it.title) || "(\u65E0\u6807\u9898)",
      link: it.link || target,
      guid: it.guid || it.id || it.link || target,
      description: it.description || it.title || "",
      pubDate: it.pubDate || (/* @__PURE__ */ new Date()).toUTCString(),
      author: it.author || ""
    }))
  };
  ctx.header("Content-Type", "application/xml");
  return ctx.body(renderRss2(data));
}
__name(deal5, "deal");
var setup6 = /* @__PURE__ */ __name((route2) => {
  route2.get("/custom/:id", deal5);
}, "setup");
var custom_default = { setup: setup6 };

// src/lib/platforms/index.js
var route = new Hono2();
bilibili_default.setup(route);
douyin_default.setup(route);
weibo_default.setup(route);
xiaohongshu_default.setup(route);
telegram_default2.setup(route);
custom_default.setup(route);
var platforms_default = route;

// src/worker.js
var app = new Hono2();
app.use("/*", cors());
async function hashPassword(password) {
  const data = new TextEncoder().encode(password + "::hotnews_salt_v1");
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(hashPassword, "hashPassword");
function generateToken() {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(generateToken, "generateToken");
function generateId() {
  const arr = new Uint8Array(8);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(generateId, "generateId");
function getSessionToken(ctx) {
  const cookie = ctx.req.header("Cookie") || "";
  const m = cookie.match(/hotnews_session=([^;]+)/);
  return m ? m[1] : null;
}
__name(getSessionToken, "getSessionToken");
async function verifySession(ctx) {
  const token = getSessionToken(ctx);
  if (!token) return null;
  try {
    const data = await ctx.env.KV.get("hotnews:session:" + token);
    if (!data) return null;
    const session = JSON.parse(data);
    if (Date.now() > session.expires) {
      await ctx.env.KV.delete("hotnews:session:" + token);
      return null;
    }
    return session;
  } catch (e) {
    return null;
  }
}
__name(verifySession, "verifySession");
function setSessionCookie(ctx, token) {
  const secure = (ctx.req.url || "").startsWith("https") ? "Secure; " : "";
  ctx.header("Set-Cookie", `hotnews_session=${token}; HttpOnly; ${secure}SameSite=Lax; Path=/; Max-Age=604800`);
}
__name(setSessionCookie, "setSessionCookie");
function clearSessionCookie(ctx) {
  ctx.header("Set-Cookie", "hotnews_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0");
}
__name(clearSessionCookie, "clearSessionCookie");
var SECRET_FIELDS = ["api_key", "secret_key", "access_key", "app_secret", "resend_api_key", "bot_token", "token", "password_hash", "apiKey", "secretKey", "accessKey"];
function isSecretKey(key) {
  return SECRET_FIELDS.includes(key);
}
__name(isSecretKey, "isSecretKey");
function maskConfig(obj, depth = 0) {
  if (obj === null || typeof obj !== "object" || depth > 8) return obj;
  if (Array.isArray(obj)) return obj.map((v) => maskConfig(v, depth + 1));
  const out = {};
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (typeof v === "string" && v && isSecretKey(k)) out[k] = "********";
    else if (typeof v === "object" && v !== null) out[k] = maskConfig(v, depth + 1);
    else out[k] = v;
  }
  return out;
}
__name(maskConfig, "maskConfig");
function unmaskMerge(stored, incoming) {
  if (stored === null || typeof stored !== "object") return incoming;
  if (incoming === null || typeof incoming !== "object") return incoming;
  for (const k of Object.keys(incoming)) {
    const iv = incoming[k];
    const sv = stored[k];
    if (typeof iv === "string" && iv === "********" && isSecretKey(k)) {
      incoming[k] = sv;
    } else if (typeof iv === "object" && iv !== null && !Array.isArray(iv)) {
      unmaskMerge(sv, iv);
    }
  }
  return incoming;
}
__name(unmaskMerge, "unmaskMerge");
app.get("/", async (ctx) => {
  try {
    const cfg = await getConfig(ctx.env);
    await ensureSchema(ctx.env);
    const tz = cfg.app.timezone;
    const today = todayStr(tz);
    const platformIds = (cfg.platforms.sources || []).map((s) => s.id);
    const newsByPlatform = await getNewsByDate(ctx.env, today, platformIds);
    const rssItems = await getRssByDate(ctx.env, today, void 0);
    let subscriptions = [];
    try {
      subscriptions = await pull_default.getSubscriptions(ctx.env);
    } catch (e) {
    }
    let pushRecords = [];
    try {
      const r = await ctx.env.DB.prepare("SELECT * FROM push_records WHERE date = ? ORDER BY id DESC LIMIT 20").bind(today).all();
      pushRecords = r.results || [];
    } catch (e) {
    }
    return ctx.html(renderDashboard(cfg, { newsByPlatform, rssItems, pushRecords, subscriptions }));
  } catch (e) {
    return ctx.text("Error: " + e.message, 500);
  }
});
app.get("/api/today", async (ctx) => {
  try {
    const cfg = await getConfig(ctx.env);
    await ensureSchema(ctx.env);
    const today = todayStr(cfg.app.timezone);
    const platformIds = (cfg.platforms.sources || []).map((s) => s.id);
    const newsByPlatform = await getNewsByDate(ctx.env, today, platformIds);
    const rssItems = await getRssByDate(ctx.env, today, void 0);
    return ctx.json({ date: today, news: newsByPlatform, rss: rssItems });
  } catch (e) {
    return ctx.json({ error: e.message }, 500);
  }
});
app.get("/rss", async (ctx) => {
  const subs = await pull_default.getSubscriptions(ctx.env);
  const origin = new URL(ctx.req.url).origin;
  const items = subs.map((s) => `<li><a href="${origin}${s.url}" target="_blank">${s.title || s.name}</a> <code>${origin}${s.url}</code></li>`).join("") || "<li>\u6682\u65E0\u8BA2\u9605</li>";
  return ctx.html(`<meta charset="utf-8"><h3>RSS \u8BA2\u9605\u6E90</h3><ul>${items}</ul><p><a href="/">\u8FD4\u56DE\u9996\u9875</a></p>`);
});
app.get("/rss/hot/:pid", async (ctx) => {
  try {
    const pid = ctx.req.param().pid.replace(/\.xml$/i, "");
    const cfg = await getConfig(ctx.env);
    await ensureSchema(ctx.env);
    const today = todayStr(cfg.app.timezone);
    const news = await getNewsByDate(ctx.env, today, [pid]);
    const items = (news[pid] || []).slice(0, 30).map((n) => ({
      title: n.title,
      link: n.url || "",
      guid: n.url || n.mobile_url || n.title,
      description: (n.rank ? `[\u7B2C${n.rank}\u540D] ` : "") + n.title,
      pubDate: n.date ? (/* @__PURE__ */ new Date(n.date + "T00:00:00Z")).toUTCString() : (/* @__PURE__ */ new Date()).toUTCString()
    }));
    const xml = renderRss2({
      title: `${pid} \u70ED\u699C ${today}`,
      link: new URL(ctx.req.url).origin + "/rss/hot/" + pid + ".xml",
      description: `${pid} \u5E73\u53F0\u4ECA\u65E5\u70ED\u699C\uFF08TrendRadar \u751F\u6210\uFF09`,
      language: "zh-cn",
      items
    });
    ctx.header("Content-Type", "application/rss+xml; charset=UTF-8");
    return ctx.body(xml);
  } catch (e) {
    return ctx.text("Error: " + e.message, 500);
  }
});
app.route("/rss", platforms_default);
app.get("/robots.txt", (ctx) => ctx.text("User-agent: *\nDisallow:"));
app.get("/setting", (ctx) => ctx.html(settingHtml));
app.get("/setting/api/status", async (ctx) => {
  const credExists = await ctx.env.KV.get("hotnews:auth:email");
  const session = await verifySession(ctx);
  if (session) return ctx.json({ authenticated: true, needsSetup: false, email: session.email });
  return ctx.json({ authenticated: false, needsSetup: !credExists });
});
app.post("/setting/api/setup", async (ctx) => {
  const existing = await ctx.env.KV.get("hotnews:auth:email");
  if (existing) return ctx.json({ success: false, error: "\u7BA1\u7406\u5458\u8D26\u53F7\u5DF2\u5B58\u5728" });
  const body = await ctx.req.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase();
  if (!email || !email.includes("@")) return ctx.json({ success: false, error: "\u8BF7\u8F93\u5165\u6709\u6548\u90AE\u7BB1" });
  if (!body.password || String(body.password).length < 6) return ctx.json({ success: false, error: "\u5BC6\u7801\u81F3\u5C116\u4F4D" });
  await ctx.env.KV.put("hotnews:auth:email", email);
  await ctx.env.KV.put("hotnews:auth:password_hash", await hashPassword(body.password));
  const token = generateToken();
  await ctx.env.KV.put("hotnews:session:" + token, JSON.stringify({ email, expires: Date.now() + 7 * 24 * 3600 * 1e3 }), { expirationTtl: 7 * 24 * 3600 });
  setSessionCookie(ctx, token);
  return ctx.json({ success: true, email });
});
app.post("/setting/api/login", async (ctx) => {
  const body = await ctx.req.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase();
  const storedEmail = await ctx.env.KV.get("hotnews:auth:email");
  const storedHash = await ctx.env.KV.get("hotnews:auth:password_hash");
  if (!storedEmail || !storedHash) return ctx.json({ success: false, error: "\u7CFB\u7EDF\u5C1A\u672A\u521D\u59CB\u5316" });
  if (email !== storedEmail || await hashPassword(body.password || "") !== storedHash) return ctx.json({ success: false, error: "\u90AE\u7BB1\u6216\u5BC6\u7801\u9519\u8BEF" });
  const token = generateToken();
  await ctx.env.KV.put("hotnews:session:" + token, JSON.stringify({ email, expires: Date.now() + 7 * 24 * 3600 * 1e3 }), { expirationTtl: 7 * 24 * 3600 });
  setSessionCookie(ctx, token);
  return ctx.json({ success: true, email });
});
app.post("/setting/api/logout", async (ctx) => {
  const token = getSessionToken(ctx);
  if (token) await ctx.env.KV.delete("hotnews:session:" + token);
  clearSessionCookie(ctx);
  return ctx.json({ success: true });
});
app.post("/setting/api/change-password", async (ctx) => {
  const session = await verifySession(ctx);
  if (!session) return ctx.json({ success: false, error: "\u672A\u767B\u5F55" });
  const body = await ctx.req.json().catch(() => ({}));
  const storedHash = await ctx.env.KV.get("hotnews:auth:password_hash");
  if (await hashPassword(body.oldPassword || "") !== storedHash) return ctx.json({ success: false, error: "\u5F53\u524D\u5BC6\u7801\u9519\u8BEF" });
  if (!body.newPassword || String(body.newPassword).length < 6) return ctx.json({ success: false, error: "\u65B0\u5BC6\u7801\u81F3\u5C116\u4F4D" });
  await ctx.env.KV.put("hotnews:auth:password_hash", await hashPassword(body.newPassword));
  return ctx.json({ success: true });
});
app.get("/setting/api/config", async (ctx) => {
  const session = await verifySession(ctx);
  if (!session) return ctx.json({ success: false, error: "\u672A\u767B\u5F55" });
  const cfg = await getConfig(ctx.env);
  return ctx.json({ success: true, config: maskConfig(cfg) });
});
app.put("/setting/api/config", async (ctx) => {
  const session = await verifySession(ctx);
  if (!session) return ctx.json({ success: false, error: "\u672A\u767B\u5F55" });
  const body = await ctx.req.json().catch(() => ({}));
  if (!body.config || typeof body.config !== "object") return ctx.json({ success: false, error: "\u914D\u7F6E\u683C\u5F0F\u9519\u8BEF" });
  const storedRaw = await ctx.env.KV.get("hotnews:config");
  let stored = {};
  if (storedRaw) {
    try {
      stored = JSON.parse(storedRaw);
    } catch (e) {
    }
  }
  const merged = unmaskMerge(stored, body.config);
  const cfg = await saveConfig(ctx.env, merged);
  return ctx.json({ success: true, config: maskConfig(cfg) });
});
app.put("/setting/api/config/section", async (ctx) => {
  const session = await verifySession(ctx);
  if (!session) return ctx.json({ success: false, error: "\u672A\u767B\u5F55" });
  const body = await ctx.req.json().catch(() => ({}));
  if (!body.section || !body.value || typeof body.value !== "object") return ctx.json({ success: false, error: "\u683C\u5F0F\u9519\u8BEF" });
  const storedRaw = await ctx.env.KV.get("hotnews:config");
  let stored = {};
  if (storedRaw) {
    try {
      stored = JSON.parse(storedRaw);
    } catch (e) {
    }
  }
  const existing = stored[body.section] || {};
  const mergedSection = unmaskMerge(existing, body.value);
  stored[body.section] = { ...stored[body.section] || {}, ...mergedSection };
  const cfg = await saveConfig(ctx.env, stored);
  return ctx.json({ success: true, section: body.section, config: maskConfig(cfg[body.section]) });
});
app.get("/setting/api/subscriptions", async (ctx) => {
  const session = await verifySession(ctx);
  if (!session) return ctx.json({ success: false, error: "\u672A\u767B\u5F55" });
  const subs = await pull_default.getSubscriptions(ctx.env);
  const origin = new URL(ctx.req.url).origin;
  let changed = false;
  for (const s of subs) {
    if (s.route && !s.sourceUrl) {
      s.sourceUrl = origin + s.route.replace(":uid", encodeURIComponent(s.param)).replace(":username", encodeURIComponent(s.param));
      changed = true;
    }
  }
  if (changed) await pull_default.saveSubscriptions(ctx.env, subs);
  return ctx.json({ success: true, subscriptions: subs });
});
app.post("/setting/api/subscriptions", async (ctx) => {
  const session = await verifySession(ctx);
  if (!session) return ctx.json({ success: false, error: "\u672A\u767B\u5F55" });
  const body = await ctx.req.json().catch(() => ({}));
  const subs = await pull_default.getSubscriptions(ctx.env);
  if (body.kind === "platform") {
    const pid = String(body.platformId || "").trim();
    if (!pid) return ctx.json({ success: false, error: "\u8BF7\u9009\u62E9\u70ED\u699C\u5E73\u53F0" });
    const cfg = await getConfig(ctx.env);
    const src = (cfg.platforms.sources || []).find((s) => s.id === pid);
    if (!src) return ctx.json({ success: false, error: "\u70ED\u699C\u5E73\u53F0\u4E0D\u5B58\u5728" });
    const url2 = "/rss/hot/" + pid + ".xml";
    if (subs.some((s) => s.url === url2)) return ctx.json({ success: false, error: "\u8BE5\u5E73\u53F0\u5DF2\u8BA2\u9605" });
    const name = (src.name || pid) + " \u70ED\u699C";
    const sub2 = {
      id: generateId(),
      kind: "platform",
      platformId: pid,
      name,
      icon: "\u{1F525}",
      title: String(body.title || "").trim() || name,
      url: url2,
      sourceUrl: url2,
      pullEnabled: true,
      pullTimes: [],
      createdAt: Date.now()
    };
    subs.push(sub2);
    await pull_default.saveSubscriptions(ctx.env, subs);
    return ctx.json({ success: true, subscription: sub2 });
  }
  const sourceUrl = String(body.sourceUrl || body.param || "").trim();
  if (!sourceUrl) return ctx.json({ success: false, error: "\u8BF7\u8F93\u5165\u8BA2\u9605\u5730\u5740" });
  if (!/^https?:\/\//i.test(sourceUrl)) return ctx.json({ success: false, error: "\u8BF7\u8F93\u5165\u4EE5 http(s):// \u5F00\u5934\u7684\u7F51\u5740" });
  const id = generateId();
  const url = "/rss/custom/" + id;
  if (subs.some((s) => s.url === url)) return ctx.json({ success: false, error: "\u8BE5\u8BA2\u9605\u5DF2\u5B58\u5728" });
  const sub = {
    id,
    platform: "custom",
    name: "\u81EA\u5B9A\u4E49\u7F51\u5740",
    icon: "\u{1F517}",
    param: sourceUrl,
    sourceUrl,
    title: String(body.title || "").trim() || `\u81EA\u5B9A\u4E49\u8BA2\u9605 - ${sourceUrl}`,
    url,
    pullEnabled: true,
    pullTimes: Array.isArray(body.pullTimes) ? body.pullTimes : [],
    createdAt: Date.now()
  };
  subs.push(sub);
  await pull_default.saveSubscriptions(ctx.env, subs);
  return ctx.json({ success: true, subscription: sub });
});
app.delete("/setting/api/subscriptions/:id", async (ctx) => {
  const session = await verifySession(ctx);
  if (!session) return ctx.json({ success: false, error: "\u672A\u767B\u5F55" });
  const { id } = ctx.req.param();
  const subs = await pull_default.getSubscriptions(ctx.env);
  const filtered = subs.filter((s) => s.id !== id);
  if (filtered.length === subs.length) return ctx.json({ success: false, error: "\u8BA2\u9605\u4E0D\u5B58\u5728" });
  await pull_default.saveSubscriptions(ctx.env, filtered);
  return ctx.json({ success: true });
});
app.put("/setting/api/subscriptions/:id", async (ctx) => {
  const session = await verifySession(ctx);
  if (!session) return ctx.json({ success: false, error: "\u672A\u767B\u5F55" });
  const { id } = ctx.req.param();
  const body = await ctx.req.json().catch(() => ({}));
  const subs = await pull_default.getSubscriptions(ctx.env);
  const idx = subs.findIndex((s) => s.id === id);
  if (idx === -1) return ctx.json({ success: false, error: "\u8BA2\u9605\u4E0D\u5B58\u5728" });
  if (body.title !== void 0) subs[idx].title = String(body.title).trim() || subs[idx].title;
  if (body.sourceUrl !== void 0 && subs[idx].platform === "custom") {
    subs[idx].sourceUrl = String(body.sourceUrl).trim();
    subs[idx].param = subs[idx].sourceUrl;
  }
  if (body.pullEnabled !== void 0) subs[idx].pullEnabled = body.pullEnabled === true;
  if (body.pullTimes !== void 0) subs[idx].pullTimes = Array.isArray(body.pullTimes) ? body.pullTimes : [];
  await pull_default.saveSubscriptions(ctx.env, subs);
  return ctx.json({ success: true, subscription: subs[idx] });
});
app.post("/api/pull", async (ctx) => {
  try {
    const session = await verifySession(ctx);
    if (!session) {
      const key = ctx.req.header("X-Pull-Key") || new URL(ctx.req.url).searchParams.get("key") || "";
      const stored = await ctx.env.KV.get("hotnews:pull:key");
      if (key !== stored) return ctx.json({ success: false, error: "\u672A\u6388\u6743" });
    }
    const running = await ctx.env.KV.get("hotnews:pipeline:running");
    if (running === "1") return ctx.json({ success: true, running: true, message: "\u6D41\u6C34\u7EBF\u8FD0\u884C\u4E2D\uFF0C\u8BF7\u7A0D\u5019" });
    const exec = ctx.executionCtx;
    exec.waitUntil((async () => {
      try {
        await pull_default.runPipeline(ctx.env, { trigger: "manual" });
      } catch (e) {
        console.error("\u624B\u52A8\u6D41\u6C34\u7EBF\u5931\u8D25", e);
      }
    })());
    return ctx.json({ success: true, running: false, message: "\u5DF2\u5F00\u59CB\u6D41\u6C34\u7EBF\uFF08\u540E\u53F0\u6267\u884C\uFF09" });
  } catch (e) {
    return ctx.json({ success: false, error: e.message });
  }
});
app.post("/message", async (ctx) => {
  try {
    const raw = await ctx.req.text().catch(() => "");
    if (!raw || !raw.trim()) return ctx.json({ success: false, error: "\u7A7A\u6D88\u606F" });
    let title = "", content = "";
    try {
      const b = JSON.parse(raw);
      content = String(b.content || b.message || "");
      title = String(b.title || "");
    } catch (e) {
      content = raw.trim();
    }
    if (!content) return ctx.json({ success: false, error: "\u7F3A\u5C11 content" });
    const cfg = await getConfig(ctx.env);
    const results = await push(ctx.env, cfg, content, title);
    return ctx.json({ success: true, received: { title, content }, push: results });
  } catch (e) {
    return ctx.json({ success: false, error: e.message });
  }
});
app.get("/setting/api/pull-status", async (ctx) => {
  const session = await verifySession(ctx);
  if (!session) return ctx.json({ success: false, error: "\u672A\u767B\u5F55" });
  const running = await ctx.env.KV.get("hotnews:pipeline:running") === "1";
  const last = await ctx.env.KV.get("hotnews:pipeline:last");
  const lastCrawl = await ctx.env.KV.get("hotnews:hotlist:last");
  let lastRun = null;
  if (last) {
    try {
      lastRun = JSON.parse(last);
    } catch (e) {
    }
  }
  const subs = await pull_default.getSubscriptions(ctx.env);
  return ctx.json({
    success: true,
    running,
    scheduleCron: "*/15 * * * *",
    lastRun,
    lastCrawl: lastCrawl ? new Date(Number(lastCrawl)).toISOString() : null,
    subscriptions: subs.map((s) => ({ id: s.id, title: s.title, pullEnabled: !!s.pullEnabled, pullTimes: s.pullTimes || [], lastPull: s.lastPull || null }))
  });
});
app.put("/setting/api/pull-key", async (ctx) => {
  const session = await verifySession(ctx);
  if (!session) return ctx.json({ success: false, error: "\u672A\u767B\u5F55" });
  const body = await ctx.req.json().catch(() => ({}));
  await ctx.env.KV.put("hotnews:pull:key", String(body.key || "").trim());
  return ctx.json({ success: true });
});
app.post("/setting/api/test-push", async (ctx) => {
  const session = await verifySession(ctx);
  if (!session) return ctx.json({ success: false, error: "\u672A\u767B\u5F55" });
  const cfg = await getConfig(ctx.env);
  const results = await push_default.push(ctx.env, cfg, "\u3010\u6D4B\u8BD5\u6D88\u606F\u3011hot-news \u63A8\u9001\u901A\u9053\u914D\u7F6E\u6B63\u5E38 \u{1F389}\n" + nowMinuteStr(cfg.app.timezone));
  return ctx.json({ success: true, results });
});
app.post("/setting/api/push-now", async (ctx) => {
  const session = await verifySession(ctx);
  if (!session) return ctx.json({ success: false, error: "\u672A\u767B\u5F55" });
  try {
    const results = await pull_default.pushNow(ctx.env);
    return ctx.json(results);
  } catch (e) {
    return ctx.json({ success: false, error: e.message });
  }
});
app.post("/setting/api/report", async (ctx) => {
  const session = await verifySession(ctx);
  if (!session) return ctx.json({ success: false, error: "\u672A\u767B\u5F55" });
  try {
    const body = await ctx.req.json().catch(() => ({}));
    const type = body.type === "weekly" ? "weekly" : "daily";
    const cfg = await getConfig(ctx.env);
    const r = await pull_default.buildAndPushScheduled(ctx.env, cfg, {
      days: type === "weekly" ? 7 : 1,
      title: type === "weekly" ? "\u70ED\u70B9\u5468\u62A5" : "\u70ED\u70B9\u65E5\u62A5",
      withAnalysis: true
    });
    return ctx.json({ success: true, ...r });
  } catch (e) {
    return ctx.json({ success: false, error: e.message });
  }
});
app.post("/setting/api/backup", async (ctx) => {
  const session = await verifySession(ctx);
  if (!session) return ctx.json({ success: false, error: "\u672A\u767B\u5F55" });
  const cfg = await getConfig(ctx.env);
  const res = await backup_default.run(ctx.env, cfg);
  return ctx.json({ success: res.ok, ...res });
});
app.get("/setting/api/ai-status", async (ctx) => {
  const session = await verifySession(ctx);
  if (!session) return ctx.json({ success: false, error: "\u672A\u767B\u5F55" });
  const cfg = await getConfig(ctx.env);
  return ctx.json({ success: true, available: aiAvailable(cfg, ctx.env), provider: cfg.ai.provider, model: cfg.ai.model });
});
app.get("/help", async (ctx) => ctx.html(helpHtml));
app.get("/qq/event", async (ctx) => ctx.json({ ret: 0 }));
app.post("/qq/event", async (ctx) => {
  try {
    const body = await ctx.req.json().catch(() => null);
    const d = body && body.d;
    if (d) {
      if (d.user_openid) await ctx.env.KV.put("hotnews:qq:user_openid", String(d.user_openid));
      if (d.group_openid) await ctx.env.KV.put("hotnews:qq:group_openid", String(d.group_openid));
    }
    return ctx.json({ ret: 0 });
  } catch (e) {
    return ctx.json({ ret: 0 });
  }
});
app.get("/setting/api/qq-openids", async (ctx) => {
  const session = await verifySession(ctx);
  if (!session) return ctx.json({ success: false, error: "\u672A\u767B\u5F55" });
  const userOpenid = await ctx.env.KV.get("hotnews:qq:user_openid");
  const groupOpenid = await ctx.env.KV.get("hotnews:qq:group_openid");
  return ctx.json({ success: true, userOpenid, groupOpenid });
});
app.notFound((ctx) => ctx.html(notFoundHtml, 404));
app.onError((err, c) => c.text("Error: " + (err && err.message ? err.message : err), 500));
async function scheduled(event, env, ctx) {
  const cfg = await getConfig(env).catch(() => null);
  if (cfg) await ensureSchema(env);
  const result = await pull_default.runPipeline(env, { trigger: "cron" });
  if (result) {
    await env.KV.put("hotnews:pipeline:last", JSON.stringify({ time: Date.now(), ...result })).catch(() => {
    });
  }
}
__name(scheduled, "scheduled");
var worker_default = {
  fetch: /* @__PURE__ */ __name((request, env, ctx) => app.fetch(request, env, ctx), "fetch"),
  scheduled
};
export {
  worker_default as default
};
/*! Bundled license information:

mustache/mustache.mjs:
  (*!
   * mustache.js - Logic-less {{mustache}} templates with JavaScript
   * http://github.com/janl/mustache.js
   *)
*/
//# sourceMappingURL=worker.js.map

