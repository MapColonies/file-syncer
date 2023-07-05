import fs from 'fs';
import { randSentence } from '@ngneat/falso';
import { NFSConfig } from '../../src/common/interfaces';

export class NFSHelper {
  public constructor(private readonly config: NFSConfig) {}

  public async createFileOfModel(model: string, file: string): Promise<string> {
    const dirPath = `${this.config.pvPath}/${model}`;
    if (!fs.existsSync(dirPath)) {
      await fs.promises.mkdir(dirPath);
    }
    const filePath = `${dirPath}/${file}`;
    const data = randSentence();
    await fs.promises.writeFile(filePath, data);
    return data;
  }

  public async readFile(path: string): Promise<Buffer> {
    return fs.promises.readFile(`${this.config.pvPath}/${path}`);
  }

  public async cleanNFS(): Promise<void> {
    await fs.promises.rm(this.config.pvPath, { recursive: true });
  }

  public initNFS(): void {
    fs.mkdirSync(this.config.pvPath, { recursive: true });
  }
}
