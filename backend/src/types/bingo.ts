export type BingoCell = {
  positionId: number;
  value: number | null;
  isOpened: boolean;
  isFree: boolean; //#TODO isFree は意味論てきに実装するべきか
};

export type BingoCard = {
  cells: BingoCell[];
};
