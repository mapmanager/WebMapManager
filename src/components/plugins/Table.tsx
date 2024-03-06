import { useMemo } from "react";
import { PluginProps } from ".";
import { Table } from "rsuite";
import { useAsync } from "react-use";

const { Column, HeaderCell, Cell } = Table;

export const TableView = ({ loader, height }: PluginProps) => {
  const { loading, value: stats } = useAsync(async () => {
    return await loader.table();
  }, [loader]);

  const [columns, data] = useMemo(() => {
    if (!stats) return [[], []];
    return [
      stats.columns.tolist().toJs(),
      stats.values
        .tolist()
        .toJs()
        .map((data: any[]) => ({ data })),
    ];
  }, [stats]);

  return (
    <div style={{ background: "#1a1a1a" }}>
      <Table
        loading={loading}
        height={height}
        data={data}
        wordWrap={true}
        headerHeight={65}
      >
        {columns.map((name: string, index: number) => {
          return (
            <Column key={name} width={100} resizable>
              <HeaderCell>{name}</HeaderCell>
              <Cell>{(rowData) => rowData.data[index]}</Cell>
            </Column>
          );
        })}
      </Table>
    </div>
  );
};
