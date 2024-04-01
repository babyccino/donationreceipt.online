import { ColumnDef } from "@tanstack/react-table"
import { useState } from "react"

import {
  ColumnFiltersState,
  SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { Button } from "components/dist/ui/button"
import { Input } from "components/dist/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "components/dist/ui/table"

type extract<T extends number[]> = T[number]

export type FilterType<TColumns extends ColumnDef<any, any>[]> = {
  id: TColumns[number]["id"] & string
  placeholder: string
}
export type DataTableProps<TData, TColumns extends ColumnDef<TData, any>[]> = {
  columns: TColumns
  data: TData[]
  filters?: FilterType<TColumns>[]
}
export function DataTable<
  TData,
  TColumns extends ColumnDef<TData, any>[] = ColumnDef<TData, any>[],
>({ columns, data, filters }: DataTableProps<TData, TColumns>) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnFiltersChange: setColumnFilters,
    state: {
      sorting,
      columnFilters,
    },
  })
  return (
    <div>
      {filters && (
        <div className="flex items-center py-4">
          {filters?.map(filter => {
            if (!filter.id) return
            return (
              <Input
                key={filter.id}
                placeholder={filter.placeholder}
                value={(table.getColumn(filter.id)?.getFilterValue() as string) ?? ""}
                onChange={event => {
                  const column = table.getColumn(filter.id)
                  if (!column) return
                  const filterValue = column.getFilterValue()
                  if (filterValue === event.target.value) return
                  column.setFilterValue(event.target.value)
                }}
                className="max-w-sm"
              />
            )
          })}
        </div>
      )}
      <div className="rounded-md">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map(headerGroup => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map(header => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map(row => (
                <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                  {row.getVisibleCells().map(cell => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-end space-x-2 py-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          Next
        </Button>
      </div>
    </div>
  )
}
