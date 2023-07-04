import fs from 'fs';
import { randSentence } from '@ngneat/falso';
import { inject, injectable } from 'tsyringe';
import { SERVICES } from '../../src/common/constants';
import { NFSProvidersConfig } from '../../src/common/interfaces';

@injectable()
export class NfsHelper {
  public constructor(@inject(SERVICES.NFS_CONFIG) private readonly config: NFSProvidersConfig) {}

  public async createFileOfModel(model: string, file: string): Promise<string> {
    if (this.config.source === undefined) {
      throw new Error('no source pv path');
    }

    const dirPath = `${this.config.source.pvPath}/${model}`;
    await fs.promises.mkdir(dirPath);
    const filePath = `${dirPath}/${file}`;
    const data = randSentence();
    await fs.promises.writeFile(filePath, data);
    return data;
  }

  public async readFile(path: string): Promise<Buffer> {
    if (this.config.destination === undefined) {
      throw new Error('no destination configured');
    }

    const dirPath = `${this.config.destination.pvPath}/${path}`;
    const data = await fs.promises.readFile(dirPath);
    return data;
  }

  public async cleanNFS(): Promise<void> {
    if (this.config.source != undefined) {
      await fs.promises.rm(this.config.source.pvPath, { recursive: true });
    }

    if (this.config.destination != undefined) {
      await fs.promises.rm(this.config.destination.pvPath, { recursive: true });
    }
  }

  public initNFS(): void {
    if (this.config.source === undefined) {
      throw new Error('no source configured');
    }
    fs.mkdirSync(this.config.source.pvPath);
    if (this.config.destination === undefined) {
      throw new Error('no destination configured');
    }
    fs.mkdirSync(this.config.destination.pvPath);
  }
}
