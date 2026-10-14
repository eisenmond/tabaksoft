import { BaseDAO } from "./base.dao.js";

export class AccountTokensDAO extends BaseDAO {
  async issue({ userId, type, tokenHash, expiresAt, metadata = {} }) {
    await this.collection.deleteMany({ userId, type, usedAt: null });
    return this.create({ userId, type, tokenHash, expiresAt, usedAt: null, ...metadata });
  }

  async consume(tokenHash, type) {
    const result = await this.collection.findOneAndUpdate(
      { tokenHash, type, usedAt: null, expiresAt: { $gt: new Date() } },
      { $set: { usedAt: new Date(), updatedAt: new Date() } },
      { returnDocument: "after" },
    );
    return result.value;
  }

  async revokeForUser(userId) { await this.collection.updateMany({ userId, usedAt: null }, { $set: { usedAt: new Date() } }); }
  async createIndexes() {
    await this.collection.createIndex({ tokenHash: 1, type: 1 }, { unique: true });
    await this.collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  }
}
