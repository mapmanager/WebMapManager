import { useMemo } from "react";
import { PluginProps } from ".";
import { Table } from "rsuite";
import { DATA_VERSION } from "./globals";

const { Column, HeaderCell, Cell } = Table;

export const TableView = ({ loader, height }: PluginProps) => {
  const [columns, names, data] = useMemo(() => {
    const stats = loader.table();
    if (!stats) return [[], []];
    const columns = stats.columns.to_list();
    const attributes = loader.columnsAttributes();
    return [
      columns,
      columns.map((column: string) => attributes[column].title),
      stats.values
        .tolist()
        .toJs()
        .map((data: any[]) => ({ data })),
    ];
  }, [loader, DATA_VERSION.value]);

  return (
    <div style={{ background: "#1a1a1a" }}>
      <Table height={height} data={data} wordWrap={true} headerHeight={65}>
        {columns.map((name: string, index: number) => {
          return (
            <Column key={name} width={100} resizable>
              <HeaderCell>{names[index]}</HeaderCell>
              <Cell>{(rowData) => rowData.data[index]}</Cell>
            </Column>
          );
        })}
      </Table>
    </div>
  );
};
