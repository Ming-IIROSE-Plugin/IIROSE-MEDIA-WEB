export interface EapiResult {
  params: string;
}
let maxDigits, ZERO_ARRAY, bigZero: BigInt, bigOne: BigInt;
const highBitMasks = new Array(
  0,
  32768,
  49152,
  57344,
  61440,
  63488,
  64512,
  65024,
  65280,
  65408,
  65472,
  65504,
  65520,
  65528,
  65532,
  65534,
  65535,
);
const hexToChar = new Array(
  "0",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "a",
  "b",
  "c",
  "d",
  "e",
  "f",
);
const lowBitMasks = new Array(
  0,
  1,
  3,
  7,
  15,
  31,
  63,
  127,
  255,
  511,
  1023,
  2047,
  4095,
  8191,
  16383,
  32767,
  65535,
);
const hexatrigesimalToChar = new Array(
  "0",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "a",
  "b",
  "c",
  "d",
  "e",
  "f",
  "g",
  "h",
  "i",
  "j",
  "k",
  "l",
  "m",
  "n",
  "o",
  "p",
  "q",
  "r",
  "s",
  "t",
  "u",
  "v",
  "w",
  "x",
  "y",
  "z",
);
const biRadixBits = 16,
  bitsPerDigit = biRadixBits,
  biRadix = 65536,
  biHalfRadix = biRadix >>> 1,
  biRadixSquared = biRadix * biRadix,
  maxDigitVal = biRadix - 1;
function a(a: number) {
  let d,
    e,
    b = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
    c = "";
  for (d = 0; a > d; d += 1)
    ((e = Math.random() * b.length), (e = Math.floor(e)), (c += b.charAt(e)));
  return c;
}

async function b(a: string, b: string) {
  const encoder = new TextEncoder();

  // Convert key and IV to ArrayBuffer
  const key = encoder.encode(b);
  const iv = encoder.encode("0102030405060708");

  // Import key for AES-CBC
  const cryptoKey = await window.crypto.subtle.importKey(
    "raw",
    key,
    { name: "AES-CBC" },
    false,
    ["encrypt"],
  );

  // Convert plaintext to ArrayBuffer
  const plaintext = encoder.encode(a);

  // Perform encryption
  const encrypted = await window.crypto.subtle.encrypt(
    {
      name: "AES-CBC",
      iv: iv,
    },
    cryptoKey,
    plaintext,
  );

  // Convert the result to a Base64 string
  return btoa(String.fromCharCode(...new Uint8Array(encrypted)));
}
function c(a: string, b: string, c: string) {
  setMaxDigits(131);
  const d = new RSAKeyPair(b, "", c);
  return encryptedString(d, a);
}

/**
 * weapi
 * @param param
 * @param e
 * @param f
 * @param g
 * @returns
 */
export async function d(
  param: object,
  e: string = "010001",
  f: string = "00e0b509f6259df8642dbc35662901477df22677ec152b5ff68ace615bb7b725152b3ab17a876aea8a5aa76d2e417629ec4ee341f56135fccf695280104e0312ecbda92557c93870114af6c9d05c4f7f0c3685b7a46bee255932575cce10b424d813cfe4875d3e82047b97ddef52741d546b8e289dc6935b3ece0462db0a22b8e7",
  g: string = "0CoJUm6Qyw8W8jud",
) {
  const d = JSON.stringify(param);
  const h = {
      encText: "",
      encSecKey: "",
    },
    i = a(16);
  return (
    (h.encText = await b(d, g)),
    (h.encText = await b(h.encText, i)),
    (h.encSecKey = c(i, e, f)),
    h
  );
}

class RSAKeyPair {
  e: BigInt;
  d: BigInt;
  m: BigInt;
  chunkSize: number;
  radix: number;
  barrett: any;
  constructor(a: string, b: string, c: string) {
    ((this.e = this.biFromHex(a)),
      (this.d = this.biFromHex(b)),
      (this.m = this.biFromHex(c)),
      (this.chunkSize = 2 * biHighIndex(this.m)),
      (this.radix = 16),
      (this.barrett = new BarrettMu(this.m)));
  }

  biFromHex(a: string) {
    let d,
      e,
      b = new BigInt(),
      c = a.length;
    for (d = c, e = 0; d > 0; d -= 4, ++e)
      if (b.digits)
        // b.digits[e] = this.hexToDigit(a.substr(Math.max(d - 4, 0), Math.min(d, 4)));
        b.digits[e] = this.hexToDigit(a.substring(Math.max(d - 4, 0), d));
    return b;
  }

  hexToDigit(a: string) {
    let d,
      b = 0,
      c = Math.min(a.length, 4);
    for (d = 0; c > d; ++d) ((b <<= 4), (b |= this.charToHex(a.charCodeAt(d))));
    return b;
  }

  charToHex(a: number) {
    let b = 48,
      c = b + 9,
      d = 97,
      e = d + 25,
      f = 65,
      g = 90;
    return a >= b && c >= a
      ? a - b
      : a >= f && g >= a
        ? 10 + a - f
        : a >= d && e >= a
          ? 10 + a - d
          : 0;
  }
}

class BigInt {
  digits: number[];
  isNeg: boolean;
  constructor(a: boolean | undefined = undefined) {
    const ZERO_ARRAY = new Array(131).fill(0);
    this.digits =
      typeof a === "boolean" && a === true ? [1] : ZERO_ARRAY.slice(0); // [1] original null
    this.isNeg = false;
  }
}

class BarrettMu {
  modulus: BigInt;
  k: number;
  bkplus1: BigInt;
  mu: BigInt;
  modulo: (a: BigInt) => BigInt;
  multiplyMod: (a: BigInt, b: BigInt) => BigInt;
  powMod: (a: BigInt, b: BigInt) => BigInt;

  constructor(a: BigInt) {
    ((this.modulus = biCopy(a)), (this.k = biHighIndex(this.modulus) + 1));
    const b = new BigInt();
    ((b.digits[2 * this.k] = 1),
      (this.mu = this.biDivide(b, this.modulus)),
      (this.bkplus1 = new BigInt()),
      (this.bkplus1.digits[this.k + 1] = 1),
      (this.modulo = this.BarrettMu_modulo),
      (this.multiplyMod = this.BarrettMu_multiplyMod),
      (this.powMod = this.BarrettMu_powMod));
  }

  BarrettMu_modulo(a: BigInt) {
    let i,
      b = this.biDivideByRadixPower(a, this.k - 1),
      c = this.biMultiply(b, this.mu),
      d = this.biDivideByRadixPower(c, this.k + 1),
      e = this.biModuloByRadixPower(a, this.k + 1),
      f = this.biMultiply(d, this.modulus),
      g = this.biModuloByRadixPower(f, this.k + 1),
      h = biSubtract(e, g);
    for (
      h.isNeg && (h = biAdd(h, this.bkplus1)),
        i = biCompare(h, this.modulus) >= 0;
      i;
    )
      ((h = biSubtract(h, this.modulus)),
        (i = biCompare(h, this.modulus) >= 0));
    return h;
  }

  BarrettMu_multiplyMod(a: BigInt, b: BigInt) {
    let c = this.biMultiply(a, b);
    return this.modulo(c);
  }

  BarrettMu_powMod(a: BigInt, b: BigInt) {
    let d,
      e,
      c = new BigInt();
    for (c.digits[0] = 1, d = a, e = b; ;) {
      if (
        (0 != (1 & e.digits[0]) && (c = this.multiplyMod(c, d)),
        (e = biShiftRight(e, 1)),
        0 == e.digits[0] && 0 == biHighIndex(e))
      )
        break;
      d = this.multiplyMod(d, d);
    }
    return c;
  }

  biModuloByRadixPower(a: BigInt, b: number) {
    const c = new BigInt();
    return (arrayCopy(a.digits, 0, c.digits, 0, b), c);
  }

  biMultiply(a: BigInt, b: BigInt) {
    let d, h, i, k;
    const c = new BigInt(),
      e = biHighIndex(a),
      f = biHighIndex(b);
    let j: number;
    for (k = 0; f >= k; ++k) {
      for (d = 0, i = k, j = 0; e >= j; ++j, ++i)
        ((h = c.digits[i] + a.digits[j] * b.digits[k] + d),
          (c.digits[i] = h & maxDigitVal),
          (d = h >>> biRadixBits));
      c.digits[k + e + 1] = d;
    }
    return ((c.isNeg = a.isNeg != b.isNeg), c);
  }

  biDivideByRadixPower(a: BigInt, b: number) {
    const c = new BigInt();
    return (arrayCopy(a.digits, b, c.digits, 0, c.digits.length - b), c);
  }

  biDivide(a: BigInt, b: BigInt) {
    return biDivideModulo(a, b)[0];
  }
}

function setMaxDigits(a: number) {
  ((maxDigits = a), (ZERO_ARRAY = new Array(maxDigits)));
  for (let b = 0; b < ZERO_ARRAY.length; b++) ZERO_ARRAY[b] = 0;
  ((bigZero = new BigInt()), (bigOne = new BigInt()), (bigOne.digits[0] = 1));
}

function biHighIndex(a: BigInt) {
  if (a.digits) {
    for (var b = a.digits.length - 1; b > 0 && 0 == a.digits[b];) --b;
    return b;
  } else {
    return 0;
  }
}

/** */

function biDivideModulo(a: BigInt, b: BigInt) {
  let f,
    g,
    h,
    i,
    j,
    k,
    l,
    m,
    n,
    o,
    p,
    q,
    r,
    s,
    c = biNumBits(a),
    d = biNumBits(b);
  const e = b.isNeg;
  if (d > c)
    return (
      a.isNeg
        ? ((f = biCopy(bigOne)),
          (f.isNeg = !b.isNeg),
          (a.isNeg = !1),
          (b.isNeg = !1),
          (g = biSubtract(b, a)),
          (a.isNeg = !0),
          (b.isNeg = e))
        : ((f = new BigInt()), (g = biCopy(a))),
      new Array(f, g)
    );
  for (
    f = new BigInt(), g = a, h = Math.ceil(d / bitsPerDigit) - 1, i = 0;
    b.digits[h] < biHalfRadix;
  )
    ((b = biShiftLeft(b, 1)), ++i, ++d, (h = Math.ceil(d / bitsPerDigit) - 1));
  for (
    g = biShiftLeft(g, i),
      c += i,
      j = Math.ceil(c / bitsPerDigit) - 1,
      k = biMultiplyByRadixPower(b, j - h);
    -1 != biCompare(g, k);
  )
    (++f.digits[j - h], (g = biSubtract(g, k)));
  for (l = j; l > h; --l) {
    for (
      m = l >= g.digits.length ? 0 : g.digits[l],
        n = l - 1 >= g.digits.length ? 0 : g.digits[l - 1],
        o = l - 2 >= g.digits.length ? 0 : g.digits[l - 2],
        p = h >= b.digits.length ? 0 : b.digits[h],
        q = h - 1 >= b.digits.length ? 0 : b.digits[h - 1],
        f.digits[l - h - 1] =
          m == p ? maxDigitVal : Math.floor((m * biRadix + n) / p),
        r = f.digits[l - h - 1] * (p * biRadix + q),
        s = m * biRadixSquared + (n * biRadix + o);
      r > s;
    )
      (--f.digits[l - h - 1],
        (r = f.digits[l - h - 1] * ((p * biRadix) | q)),
        (s = m * biRadix * biRadix + (n * biRadix + o)));
    ((k = biMultiplyByRadixPower(b, l - h - 1)),
      (g = biSubtract(g, biMultiplyDigit(k, f.digits[l - h - 1]))),
      g.isNeg && ((g = biAdd(g, k)), --f.digits[l - h - 1]));
  }
  return (
    (g = biShiftRight(g, i)),
    (f.isNeg = a.isNeg != e),
    a.isNeg &&
      ((f = e ? biAdd(f, bigOne) : biSubtract(f, bigOne)),
      (b = biShiftRight(b, i)),
      (g = biSubtract(b, g))),
    0 == g.digits[0] && 0 == biHighIndex(g) && (g.isNeg = !1),
    new Array(f, g)
  );
}

function biNumBits(a: BigInt) {
  const b = biHighIndex(a),
    d = (b + 1) * bitsPerDigit;
  let e,
    c = a.digits[b];
  for (e = d; e > d - bitsPerDigit && 0 == (32768 & c); --e) c <<= 1;
  return e;
}

function biCopy(a: BigInt) {
  let b = new BigInt(!0);
  return ((b.digits = a.digits.slice(0)), (b.isNeg = a.isNeg), b);
}

function biSubtract(a: BigInt, b: BigInt): BigInt {
  let c, d, e, f;
  if (a.isNeg != b.isNeg)
    ((b.isNeg = !b.isNeg), (c = biAdd(a, b)), (b.isNeg = !b.isNeg));
  else {
    for (c = new BigInt(), e = 0, f = 0; f < a.digits.length; ++f)
      ((d = a.digits[f] - b.digits[f] + e),
        (c.digits[f] = 65535 & d),
        c.digits[f] < 0 && (c.digits[f] += biRadix),
        (e = 0 - Number(0 > d)));
    if (-1 == e) {
      for (e = 0, f = 0; f < a.digits.length; ++f)
        ((d = 0 - c.digits[f] + e),
          (c.digits[f] = 65535 & d),
          c.digits[f] < 0 && (c.digits[f] += biRadix),
          (e = 0 - Number(0 > d)));
      c.isNeg = !a.isNeg;
    } else c.isNeg = a.isNeg;
  }
  return c;
}

function biAdd(a: BigInt, b: BigInt): BigInt {
  let c, d, e, f;
  if (a.isNeg != b.isNeg)
    ((b.isNeg = !b.isNeg), (c = biSubtract(a, b)), (b.isNeg = !b.isNeg));
  else {
    for (c = new BigInt(), d = 0, f = 0; f < a.digits.length; ++f)
      ((e = a.digits[f] + b.digits[f] + d),
        (c.digits[f] = 65535 & e),
        (d = Number(e >= biRadix)));
    c.isNeg = a.isNeg;
  }
  return c;
}

function biShiftRight(a: BigInt, b: number) {
  let e, f, g, h;
  const c = Math.floor(b / bitsPerDigit),
    d = new BigInt();
  for (
    arrayCopy(a.digits, c, d.digits, 0, a.digits.length - c),
      e = b % bitsPerDigit,
      f = bitsPerDigit - e,
      g = 0,
      h = g + 1;
    g < d.digits.length - 1;
    ++g, ++h
  )
    d.digits[g] = (d.digits[g] >>> e) | ((d.digits[h] & lowBitMasks[e]) << f);
  return ((d.digits[d.digits.length - 1] >>>= e), (d.isNeg = a.isNeg), d);
}

function biMultiplyByRadixPower(a: BigInt, b: number) {
  const c = new BigInt();
  return (arrayCopy(a.digits, 0, c.digits, b, c.digits.length - b), c);
}

function arrayCopy(a: number[], b: number, c: number[], d: number, e: number) {
  let g, h;
  const f = Math.min(b + e, a.length);
  for (g = b, h = d; f > g; ++g, ++h) c[h] = a[g];
}

function biMultiplyDigit(a: BigInt, b: number) {
  let c, d, e, f;
  let result: BigInt;
  for (result = new BigInt(), c = biHighIndex(a), d = 0, f = 0; c >= f; ++f)
    ((e = result.digits[f] + a.digits[f] * b + d),
      (result.digits[f] = e & maxDigitVal),
      (d = e >>> biRadixBits));
  return ((result.digits[1 + c] = d), result);
} // 不确定对不对

function biShiftLeft(a: BigInt, b: number) {
  let e, f, g, h;
  const c = Math.floor(b / bitsPerDigit),
    d = new BigInt();
  for (
    arrayCopy(a.digits, 0, d.digits, c, d.digits.length - c),
      e = b % bitsPerDigit,
      f = bitsPerDigit - e,
      g = d.digits.length - 1,
      h = g - 1;
    g > 0;
    --g, --h
  )
    d.digits[g] =
      ((d.digits[g] << e) & maxDigitVal) |
      ((d.digits[h] & highBitMasks[e]) >>> f);
  return (
    (d.digits[0] = (d.digits[g] << e) & maxDigitVal),
    (d.isNeg = a.isNeg),
    d
  );
}

function biCompare(a: BigInt, b: BigInt) {
  if (a.isNeg != b.isNeg) return 1 - 2 * Number(a.isNeg);
  for (var c = a.digits.length - 1; c >= 0; --c)
    if (a.digits[c] != b.digits[c])
      return a.isNeg
        ? 1 - 2 * Number(a.digits[c] > b.digits[c])
        : 1 - 2 * Number(a.digits[c] < b.digits[c]);
  return 0;
}

function reverseStr(a: string) {
  let c,
    b = "";
  for (c = a.length - 1; c > -1; --c) b += a.charAt(c);
  return b;
}

function encryptedString(a: RSAKeyPair, b: string) {
  function digitToHex(a: number) {
    let b = 15,
      c = "";
    let i: number;
    for (i = 0; 4 > i; ++i) ((c += hexToChar[a & b]), (a >>>= 4));
    return reverseStr(c);
  }
  function biToHex(a: BigInt) {
    let d,
      b = "";
    for (biHighIndex(a), d = biHighIndex(a); d > -1; --d)
      b += digitToHex(a.digits[d]);
    return b;
  }

  function biToString(a: BigInt, b: number) {
    let d, e;
    const c = new BigInt();
    for (
      c.digits[0] = b,
        d = biDivideModulo(a, c),
        e = hexatrigesimalToChar[d[1].digits[0]];
      1 == biCompare(d[0], bigZero);
    )
      ((d = biDivideModulo(d[0], c)),
        (e += hexatrigesimalToChar[d[1].digits[0]]));
    return (a.isNeg ? "-" : "") + reverseStr(e);
  }

  /* 取明文的ascii码到c数组 */
  for (var f, g, h, i, j, k, l, c = [], d = b.length, e = 0; d > e;) {
    c[e] = b.charCodeAt(e);
    e++;
  }
  /* 补0到a.chunkSize，经调试，achunkSize为常量126 */
  for (; 0 !== c.length % a.chunkSize;) {
    c[e++] = 0;
  }
  /* 外层for循环其实只会被执行一次 */
  for (f = c.length, g = "", e = 0; f > e; e += a.chunkSize) {
    /* 大整数 */
    for (j = new BigInt(), h = 0, i = e; i < e + a.chunkSize; ++h) {
      j.digits[h] = c[i++];
      j.digits[h] += c[i++] << 8;
    }
    k = a.barrett.powMod(j, a.e);
    l = 16 === a.radix ? biToHex(k) : biToString(k, a.radix);
    g += l + " ";
  }
  return g.substring(0, g.length - 1);
}
