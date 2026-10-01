import type { UseQueryResult } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import type { Page } from '../api/contracts'
import { RoundButton } from './RoundButton'

export interface Column<T> {
  header: string
  cell: (row: T) => ReactNode
  className?: string
}

interface LogTableProps<T> {
  query: UseQueryResult<Page<T>>
  /** Names the table for assistive tech. */
  caption: string
  columns: readonly Column<T>[]
  rowKey: (row: T) => string
  /** Highlights the player's own rows. */
  isMine?: (row: T) => boolean
  emptyText: string
  page: number
  onPage: (page: number) => void
}

/**
 * A paginated table for one query, with every state the data can be in:
 * first load, error with Retry, empty, a background refresh, and a page
 * change (the previous page stays visible, dimmed, until the next one
 * arrives).
 */
export function LogTable<T>({
  query,
  caption,
  columns,
  rowKey,
  isMine,
  emptyText,
  page,
  onPage,
}: LogTableProps<T>) {
  const { data, isPending, isError, isFetching, isPlaceholderData, refetch } =
    query

  if (isPending) {
    return (
      <p className="log-state" role="status">
        Loading…
      </p>
    )
  }

  if (isError) {
    return (
      <div className="log-state" role="alert">
        <p>
          Could not load the {caption.toLowerCase()}. {query.error.message}
        </p>
        <button
          type="button"
          className="menu-button menu-button--secondary"
          onClick={() => {
            void refetch()
          }}
        >
          Retry
        </button>
      </div>
    )
  }

  if (data.totalItems === 0) {
    return <p className="log-state">{emptyText}</p>
  }

  return (
    <>
      <table
        className="log-table"
        aria-busy={isPlaceholderData || undefined}
        data-placeholder={isPlaceholderData || undefined}
      >
        <caption className="visually-hidden">
          {caption}, page {data.page} of {data.totalPages}
        </caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.header} scope="col" className={column.className}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.items.map((row) => (
            <tr
              key={rowKey(row)}
              className={isMine?.(row) ? 'log-row--mine' : undefined}
            >
              {columns.map((column) => (
                <td key={column.header} className={column.className}>
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <nav className="pager" aria-label={`${caption} pages`}>
        <RoundButton
          icon="controls/icon_turn_left"
          label="Previous page"
          disabled={page <= 1}
          onClick={() => {
            onPage(page - 1)
          }}
        />
        <p className="pager-label" data-testid="pager-label">
          Page {page} of {data.totalPages}
        </p>
        <RoundButton
          icon="controls/icon_turn_right"
          label="Next page"
          disabled={page >= data.totalPages}
          onClick={() => {
            onPage(page + 1)
          }}
        />
      </nav>
      <p className="log-updating" role="status">
        {isFetching ? 'Updating…' : ''}
      </p>
    </>
  )
}
