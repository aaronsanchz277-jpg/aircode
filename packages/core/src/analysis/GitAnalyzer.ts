import simpleGit from 'simple-git';

export class GitAnalyzer {
  private git = simpleGit();

  async countRecentCommits(filePath: string, days = 30): Promise<number> {
    try {
      const log = await this.git.log({
        file: filePath,
        '--since': `${days}.days`,
        '--oneline': null,
      } as any);
      return log.total;
    } catch {
      return 0;
    }
  }
}
