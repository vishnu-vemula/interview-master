import { createHash, timingSafeEqual } from 'node:crypto';

type Fields = Record<string, unknown>;
const sha512 = (value: string) => createHash('sha512').update(value, 'utf8').digest('hex');
const field = (fields: Fields, name: string) => String(fields[name] ?? '');

export const payuConfig = () => {
  const key = process.env.PAYU_MERCHANT_KEY;
  const salt = process.env.PAYU_MERCHANT_SALT;
  const mode = process.env.PAYU_ENV;
  if (!key || !salt || !['test', 'production'].includes(mode || '')) {
    throw new Error('PayU key, salt and PAYU_ENV are required');
  }
  return {
    key, salt,
    checkoutUrl: mode === 'production' ? 'https://secure.payu.in/_payment' : 'https://test.payu.in/_payment',
    apiUrl: mode === 'production' ? 'https://info.payu.in/merchant/postservice.php?form=2' : 'https://test.payu.in/merchant/postservice.php?form=2',
  };
};

export const checkoutHash = (fields: Fields, salt: string) => sha512([
  ...['key', 'txnid', 'amount', 'productinfo', 'firstname', 'email', 'udf1', 'udf2', 'udf3', 'udf4', 'udf5'].map(k => field(fields, k)),
  '', '', '', '', '', salt,
].join('|'));

export const responseHash = (fields: Fields, salt: string) => {
  const parts = [salt, field(fields, 'status'), '', '', '', '', '',
    ...['udf5', 'udf4', 'udf3', 'udf2', 'udf1', 'email', 'firstname', 'productinfo', 'amount', 'txnid', 'key'].map(k => field(fields, k))];
  if (field(fields, 'splitInfo')) parts[2] = field(fields, 'splitInfo');
  const extraCharges = field(fields, 'additionalCharges') || field(fields, 'additional_charges');
  if (extraCharges) parts.unshift(extraCharges);
  return sha512(parts.join('|'));
};

export const verifyResponseHash = (fields: Fields, salt: string) => {
  const received = field(fields, 'hash').toLowerCase();
  if (!/^[0-9a-f]{128}$/.test(received)) return false;
  return timingSafeEqual(Buffer.from(received, 'hex'), Buffer.from(responseHash(fields, salt), 'hex'));
};

export const commandHash = (key: string, command: string, var1: string, salt: string) =>
  sha512(`${key}|${command}|${var1}|${salt}`);

export const payuCommand = async (command: string, var1: string, extras: Record<string, string> = {}) => {
  const config = payuConfig();
  const params = new URLSearchParams({
    key: config.key, command, var1,
    hash: commandHash(config.key, command, var1, config.salt),
    ...extras,
  });
  const response = await fetch(config.apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`PayU request failed (${response.status})`);
  return response.json() as Promise<any>;
};
