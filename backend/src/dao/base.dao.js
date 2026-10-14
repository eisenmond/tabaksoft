import { ObjectId } from "mongodb";

export class BaseDAO {
  constructor(collection) {
    this.collection = collection;
  }

  async findById(id) {
    if (!ObjectId.isValid(id)) return null;
    return this.collection.findOne({ _id: new ObjectId(id) });
  }

  async list({ filter = {}, page = 1, limit = 20, sort = { createdAt: -1 } } = {}) {
    const safePage = Math.max(Number(page) || 1, 1);
    const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
    const [items, total] = await Promise.all([
      this.collection.find(filter).sort(sort).skip((safePage - 1) * safeLimit).limit(safeLimit).toArray(),
      this.collection.countDocuments(filter),
    ]);
    return { items, total, page: safePage, limit: safeLimit };
  }

  async create(document) {
    const now = new Date();
    const result = await this.collection.insertOne({ ...document, createdAt: now, updatedAt: now });
    return this.findById(result.insertedId.toString());
  }

  async updateById(id, changes) {
    if (!ObjectId.isValid(id)) return null;
    const result = await this.collection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: { ...changes, updatedAt: new Date() } },
      { returnDocument: "after" },
    );
    return result.value;
  }

  async deleteById(id) {
    if (!ObjectId.isValid(id)) return false;
    return (await this.collection.deleteOne({ _id: new ObjectId(id) })).deletedCount === 1;
  }
}
