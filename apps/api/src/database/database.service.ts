import { Injectable, type OnModuleDestroy } from "@nestjs/common";
import { createDatabaseClient, type DatabaseClient } from "@sistema-erp/database";

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private client?: DatabaseClient;

  get value(): DatabaseClient {
    this.client ??= createDatabaseClient();

    return this.client;
  }

  async ping(): Promise<void> {
    await this.value.$queryRaw`SELECT 1`;
  }

  async onModuleDestroy(): Promise<void> {
    await this.client?.$disconnect();
  }
}
