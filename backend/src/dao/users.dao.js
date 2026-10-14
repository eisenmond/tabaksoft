import { BaseDAO } from "./base.dao.js";

export class UsersDAO extends BaseDAO {
  async findByEmail(email) {
    return this.collection.findOne({ email: email.toLowerCase() });
  }

  async createUser({ name, email, passwordHash = null, role = "user", emailVerifiedAt = null, status = "active" }) {
    return this.create({ name, email: email.toLowerCase(), passwordHash, role, emailVerifiedAt, status, suspendedAt: null, acceptedTerms: null });
  }

  async ensureAdministrator({ name, email, passwordHash }) {
    const normalizedEmail = email.toLowerCase();
    const existing = await this.findByEmail(normalizedEmail);
    if (existing) {
      return this.updateById(existing._id.toString(), { name, passwordHash, role: "admin", status: "active", emailVerifiedAt: existing.emailVerifiedAt || new Date() });
    }
    return this.createUser({ name, email: normalizedEmail, passwordHash, role: "admin", emailVerifiedAt: new Date() });
  }

  async setPassword(id, passwordHash, extra = {}) { return this.updateById(id, { passwordHash, ...extra }); }
  async updateAccount(id, changes) { if (changes.email) changes.email = changes.email.toLowerCase(); return this.updateById(id, changes); }

  async updateProfile(id, { name, email }) {
    const changes = {};
    if (name !== undefined) changes.name = name;
    if (email !== undefined) changes.email = email.toLowerCase();
    return this.updateById(id, changes);
  }

  async createIndexes() {
    await this.collection.createIndex({ email: 1 }, { unique: true });
  }
}
