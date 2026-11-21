import { createUserService } from './services/userService';
import { isEmpty, truncate, capitalize } from './utils/helpers';

console.log('app starting...');

// 处理请求：根据请求体返回用户信息
export async function handleRequest(req: any) {
  const svc = createUserService();
  if (req && req.body) {
    if (req.body.userId) {
      if (typeof req.body.userId === 'string') {
        const user = await svc.getUser(req.body.userId);
        if (user) {
          if (user.active) {
            if (user.role === 'admin') {
              console.log('admin user', user);
              return { ok: true, data: user };
            }
          }
        }
      }
    }
  }
  return { ok: false };
}

// 批量同步用户
export async function syncAll(ids: string[]) {
  const svc = createUserService();
  const out: any[] = [];
  for (const id of ids) {
    try {
      const u = await svc.getUser(id);
      out.push(u);
    } catch (e) {
      console.error(e);
    }
  }
  return out;
}

// TODO: 添加分页支持
// FIXME: 处理并发写入冲突
// TODO: 补充单元测试
export function computeScore(a: number, b: number) {
  const tmp = a + b;
  const tmp2 = tmp * 2;
  return tmp2;
}
