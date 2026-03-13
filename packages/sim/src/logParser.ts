export interface ParsedTurn {
  turn: number;
  lines: string[];
  moves: { pokemon: string; move: string; target?: string }[];
  fainted: string[];
  weather?: string;
}

export interface ParsedBattleLog {
  turns: ParsedTurn[];
  winner?: string;
  totalTurns: number;
}

export function parseBattleLog(log: string[]): ParsedBattleLog {
  const turns: ParsedTurn[] = [];
  let currentTurn: ParsedTurn | null = null;
  let winner: string | undefined;

  for (const line of log) {
    if (line.startsWith("|turn|")) {
      if (currentTurn) turns.push(currentTurn);
      currentTurn = {
        turn: parseInt(line.slice(6), 10),
        lines: [line],
        moves: [],
        fainted: [],
      };
    } else if (line.startsWith("|move|")) {
      const parts = line.split("|");
      if (currentTurn && parts.length >= 4) {
        currentTurn.moves.push({
          pokemon: parts[2] ?? "",
          move: parts[3] ?? "",
          target: parts[4],
        });
        currentTurn.lines.push(line);
      }
    } else if (line.startsWith("|faint|")) {
      if (currentTurn) {
        currentTurn.fainted.push(line.slice(7));
        currentTurn.lines.push(line);
      }
    } else if (line.startsWith("|-weather|")) {
      if (currentTurn) {
        currentTurn.weather = line.split("|")[2];
        currentTurn.lines.push(line);
      }
    } else if (line.startsWith("|win|")) {
      winner = line.slice(5).trim();
      if (currentTurn) currentTurn.lines.push(line);
    } else if (currentTurn) {
      currentTurn.lines.push(line);
    }
  }

  if (currentTurn) turns.push(currentTurn);

  return {
    turns,
    winner,
    totalTurns: turns.length,
  };
}
