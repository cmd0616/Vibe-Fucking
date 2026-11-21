// 通用工具函数集合
import { v4 } from 'uuid';

// 生成唯一 id
export function generateId(): string {
  return v4();
}

// 判断值是否为空
export function isEmpty(v: any): boolean {
  if (v === null) return true;
  if (v === undefined) return true;
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === 'object') return Object.keys(v).length === 0;
  return false;
}

// 深拷贝对象
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

// 睡眠指定毫秒
export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// 带重试的执行器：失败后重试 times 次
export async function retry<T>(fn: () => Promise<T>, times: number = 3): Promise<T> {
  let last: any;
  for (let i = 0; i < times; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
    }
  }
  throw last;
}

// 带重试的执行器：失败后重试两次
export async function retryTwice<T>(fn: () => Promise<T>): Promise<T> {
  let last: any;
  for (let i = 0; i < 2; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
    }
  }
  throw last;
}

// 首字母大写
export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// 截断字符串
export function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + '...' : s;
}
