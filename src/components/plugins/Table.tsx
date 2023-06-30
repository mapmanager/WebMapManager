import { useMemo } from "react";
import { PluginProps } from ".";
import { Table } from "rsuite";

const { Column, HeaderCell, Cell } = Table;

export const TableView = ({ loader, height }: PluginProps) => {
  const stats = useMemo(() => loader.getSpineStats(), [loader]);
  return (
    <Table height={height} data={stats}>
      {[...Object.keys(stats[0] || {})].map((key) => {
        return (
          <Column key={key} width={100} resizable>
            <HeaderCell>{key}</HeaderCell>
            <Cell dataKey={key} />
          </Column>
        );
      })}
    </Table>
  );
};
