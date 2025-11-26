import { RenderParameters } from './rouletteRenderer';
import { MouseEventArgs, UIObject } from './UIObject';
import { bound } from './utils/bound.decorator';
import { Rect } from './types/rect.type';
import { Marble } from './marble';

export class RankRenderer implements UIObject {
  private _currentY = 0;
  private _targetY = 0;
  private fontHeight = 16;
  private _userMoved = 0;
  private _currentWinner = -1;
  private maxY = 0;
  private winners: Marble[] = [];
  private marbles: Marble[] = [];
  private winnerRank: number = -1;
  private messageHandler?: (msg: string) => void;

  private buttonBound: Rect = { x: 0, y: 0, w: 80, h: 24 };
  private isHoveringButton = false;
  private hasWinner = false;

  constructor() {
  }

  @bound
  onWheel(e: WheelEvent) {
    this._targetY += e.deltaY;
    if (this._targetY > this.maxY) {
      this._targetY = this.maxY;
    }
    this._userMoved = 2000;
  }

  @bound
  onDblClick(e?: MouseEventArgs) {
    if (e) {
      if (navigator.clipboard) {
        const tsv: string[] = [];
        let rank = 0;
        tsv.push(...[...this.winners, ...this.marbles].map((m) => {
          rank++;
          return [rank.toString(), m.name, rank - 1 === this.winnerRank ? '☆' : ''].join('\t');
        }));

        tsv.unshift(['Rank', 'Name', 'Winner'].join('\t'));

        navigator.clipboard.writeText(tsv.join('\n')).then(() => {
          if (this.messageHandler) {
            this.messageHandler('The result has been copied');
          }
        });
      }
    }
  }

  onMessage(func: (msg: string) => void) {
    this.messageHandler = func;
  }

  render(
    ctx: CanvasRenderingContext2D,
    { winners, marbles, winnerRank, theme, winner }: RenderParameters,
    width: number,
    height: number,
  ) {
    this.hasWinner = winner !== null;
    const startX = width - 5;
    const startY = Math.max(-this.fontHeight, this._currentY - height / 2);
    this.maxY = Math.max(
      0,
      (marbles.length + winners.length) * this.fontHeight + this.fontHeight,
    );
    this._currentWinner = winners.length;

    this.winners = winners;
    this.marbles = marbles;
    this.winnerRank = winnerRank;

    ctx.save();
    ctx.textAlign = 'right';
    ctx.font = '10pt sans-serif';
    ctx.fillStyle = '#666';
    ctx.fillText(`${winners.length} / ${winners.length + marbles.length}`, width - 5, this.fontHeight);

    ctx.beginPath();
    ctx.rect(width - 150, this.fontHeight + 2, width, this.maxY);
    ctx.clip();

    ctx.translate(0, -startY);
    ctx.font = 'bold 11pt sans-serif';
    if (theme.rankStroke) {
      ctx.lineWidth = 2;
      ctx.strokeStyle = theme.rankStroke;
    }
    winners.forEach((marble: { hue: number, name: string }, rank: number) => {
      const y = rank * this.fontHeight;
      if (y >= startY && y <= startY + ctx.canvas.height) {
        ctx.fillStyle = `hsl(${marble.hue} 100% ${theme.marbleLightness}`;
        ctx.strokeText(
          `${rank === winnerRank ? '☆' : '\u2714'} ${marble.name} #${rank + 1}`,
          startX,
          20 + y,
        );
        ctx.fillText(
          `${rank === winnerRank ? '☆' : '\u2714'} ${marble.name} #${rank + 1}`,
          startX,
          20 + y,
        );
      }
    });
    ctx.font = '10pt sans-serif';
    marbles.forEach((marble: { hue: number; name: string }, rank: number) => {
      const y = (rank + winners.length) * this.fontHeight;
      if (y >= startY && y <= startY + ctx.canvas.height) {
        ctx.fillStyle = `hsl(${marble.hue} 100% ${theme.marbleLightness}`;
        ctx.strokeText(
          `${marble.name} #${rank + 1 + winners.length}`,
          startX,
          20 + y,
        );
        ctx.fillText(
          `${marble.name} #${rank + 1 + winners.length}`,
          startX,
          20 + y,
        );
      }
    });
    ctx.restore();

    // Render result button (after restore to avoid clipping)
    this.buttonBound.x = width - 90;
    this.buttonBound.y = this.fontHeight + 8;
    this.renderResultButton(ctx);
  }

  update(deltaTime: number) {
    if (this._currentWinner === -1) {
      return;
    }
    if (this._userMoved > 0) {
      this._userMoved -= deltaTime;
    } else {
      this._targetY = this._currentWinner * this.fontHeight + this.fontHeight;
    }
    if (this._currentY !== this._targetY) {
      this._currentY += (this._targetY - this._currentY) * (deltaTime / 250);
    }
    if (Math.abs(this._currentY - this._targetY) < 1) {
      this._currentY = this._targetY;
    }
  }

  getBoundingBox(): Rect | null {
    return null;
  }

  onMouseMove(e?: MouseEventArgs): void {
    if (!e) {
      this.isHoveringButton = false;
      return;
    }
    const { x, y } = e;
    this.isHoveringButton =
      x >= this.buttonBound.x &&
      x <= this.buttonBound.x + this.buttonBound.w &&
      y >= this.buttonBound.y &&
      y <= this.buttonBound.y + this.buttonBound.h;
  }

  onMouseDown(e?: MouseEventArgs): void {
    if (!e || !this.hasWinner) return;
    const { x, y } = e;
    const isInButton =
      x >= this.buttonBound.x &&
      x <= this.buttonBound.x + this.buttonBound.w &&
      y >= this.buttonBound.y &&
      y <= this.buttonBound.y + this.buttonBound.h;

    if (isInButton) {
      this.showResultModal();
    }
  }

  private renderResultButton(ctx: CanvasRenderingContext2D): void {
    const { x, y, w, h } = this.buttonBound;
    const isDisabled = !this.hasWinner;

    ctx.save();
    if (isDisabled) {
      ctx.fillStyle = '#555';
    } else {
      ctx.fillStyle = this.isHoveringButton ? '#666' : '#444';
    }
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 4);
    ctx.fill();

    ctx.fillStyle = isDisabled ? '#888' : '#fff';
    ctx.font = '10pt sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('순위표', x + w / 2, y + h / 2);
    ctx.restore();
  }

  private getResultData(): { rank: number; name: string; isWinner: boolean }[] {
    const results: { rank: number; name: string; isWinner: boolean }[] = [];
    let rank = 0;
    [...this.winners, ...this.marbles].forEach((m) => {
      rank++;
      results.push({
        rank,
        name: m.name,
        isWinner: rank - 1 === this.winnerRank,
      });
    });
    return results;
  }

  private showResultModal(): void {
    const existingModal = document.getElementById('resultModal');
    if (existingModal) {
      existingModal.remove();
    }

    const results = this.getResultData();
    if (results.length === 0) return;

    const modal = document.createElement('div');
    modal.id = 'resultModal';
    modal.innerHTML = `
      <div class="result-modal-overlay"></div>
      <div class="result-modal-content">
        <h2>순위표</h2>
        <div class="result-table-container">
          <table class="result-table">
            <thead>
              <tr>
                <th>순위</th>
                <th>이름</th>
                <th>당첨</th>
              </tr>
            </thead>
            <tbody>
              ${results
                .map(
                  (r) => `
                <tr class="${r.isWinner ? 'winner-row' : ''}">
                  <td>${r.rank}</td>
                  <td>${r.name}</td>
                  <td>${r.isWinner ? '☆' : ''}</td>
                </tr>
              `,
                )
                .join('')}
            </tbody>
          </table>
        </div>
        <div class="result-modal-actions">
          <button id="btnDownloadResult">저장</button>
          <button id="btnCloseResult">닫기</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('btnCloseResult')?.addEventListener('click', () => {
      modal.remove();
    });

    modal.querySelector('.result-modal-overlay')?.addEventListener('click', () => {
      modal.remove();
    });

    document.getElementById('btnDownloadResult')?.addEventListener('click', () => {
      this.downloadResult(results);
    });
  }

  private downloadResult(results: { rank: number; name: string; isWinner: boolean }[]): void {
    const lines = ['순위\t이름\t당첨'];
    results.forEach((r) => {
      lines.push(`${r.rank}\t${r.name}\t${r.isWinner ? '☆' : ''}`);
    });

    const content = lines.join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `마블룰렛-결과-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    if (this.messageHandler) {
      this.messageHandler('결과가 저장되었습니다');
    }
  }
}
