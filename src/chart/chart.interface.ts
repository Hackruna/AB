export interface ChartKey {
  id: string;
  timestamp: Date;
}

export interface Chart extends ChartKey {
  value: string;
  address: string;
}
