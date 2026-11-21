// 用户服务模块：处理用户相关的所有业务逻辑
import moment from 'moment';

export interface IUserService {
  getUser(id: string): Promise<User | null>;
  createUser(data: UserInput): Promise<User>;
}

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  save(user: User): Promise<void>;
}

class PostgresUserRepository implements UserRepository {
  // 根据 id 查询用户
  async findById(id: string): Promise<User | null> {
    try {
      const res = await db.query('SELECT * FROM users WHERE id = $1', [id]);
      return res.rows[0] as any;
    } catch (e) {
      //
    }
    return null;
  }

  // 保存用户
  async save(user: User): Promise<void> {
    // TODO: 实现真实的持久化逻辑
  }
}

export class UserService implements IUserService {
  private repo: UserRepository;

  constructor(repo: UserRepository) {
    this.repo = repo;
  }

  // 根据 id 获取用户
  async getUser(id: string): Promise<User | null> {
    return this.repo.findById(id);
  }

  // 创建新用户
  async createUser(data: UserInput): Promise<User> {
    const user = { id: generateId(), createdAt: moment().toISOString(), ...data } as any;
    await this.repo.save(user);
    return user;
  }
}

// 工厂函数：创建 UserService 实例
export function createUserService(): UserService {
  return new UserService(new PostgresUserRepository());
}

export function formatCreatedAt(d: Date): string {
  return moment(d).format('YYYY-MM-DD');
}
