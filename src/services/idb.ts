import { readonlyArray as RA, string, taskEither as TE } from 'fp-ts';
import { flow, pipe } from 'fp-ts/lib/function';
import { DBSchema, IDBPDatabase, IndexNames, openDB } from 'idb';
import { UuidTool } from 'uuid-tool';

import { SerializedDeal } from '../model/serialization';

interface DealDB extends DBSchema {
  deal: {
    key: string
    value: {
      deal: SerializedDeal
      batchId: string
      correlationId?: string
    },
    indexes: {
      'batch': string,
      'correlation': string
    }
  },
}

type DbError =
  | "OpenDatabaseFailed"
  | "CommitRejected"
  | "InsertError"
  | "SelectError"
  | "DeleteError"

const getDb =
  TE.tryCatch(
    () => openDB<DealDB>('bridge', 2, {
      upgrade: (db) => {
        // db.deleteObjectStore("deal")
        const store = db.createObjectStore("deal")
        store.createIndex('batch', 'batchId')
        store.createIndex('correlation', 'correlationId')
      }
    }),
    (): DbError => "OpenDatabaseFailed")

export const insertDeals = <T extends string>(correlationId?: T) => (deals: ReadonlyArray<SerializedDeal>) =>
  pipe(getDb,
    TE.map(db => db.transaction('deal', 'readwrite')),
    TE.chainFirst(tran => {
      const batchId = UuidTool.newUuid()
      return pipe(deals, TE.traverseArray(deal =>
        TE.tryCatch(
          () => tran.store.put({
            deal,
            correlationId,
            batchId
          }, deal.id),
          (): DbError => "InsertError")))
    }),
    TE.chain(tran => TE.tryCatch(() => tran.done, (): DbError => "CommitRejected")))

const getByIndex = <I extends IndexNames<DealDB, 'deal'>>(idx: I) => (id: string) =>
  TE.tryCatchK((db: IDBPDatabase<DealDB>) => db.getAllFromIndex('deal', idx, id), (): DbError => "SelectError")

export const getDealsByCorrelationId = <T extends string>(correlationId: T) =>
  pipe(getDb,
    TE.chain(getByIndex('correlation')(correlationId)),
    TE.map(RA.map(row => row.deal)))

export const getBatchIdsByCorrelationId = <T extends string>(correlationId: T) =>
  pipe(getDb,
    TE.chain(getByIndex('correlation')(correlationId)),
    TE.map(flow(
      RA.map(row => row.batchId),
      RA.uniq(string.Eq))))

export const getDealsByBatchId = (batchId: string) =>
  pipe(getDb,
    TE.chain(getByIndex('batch')(batchId)),
    TE.map(RA.map(row => row.deal)))

export const deleteByCorrelationId = <T extends string>(correlationId: T) =>
  pipe(TE.Do,
    TE.apS('db', getDb),
    TE.bind('tran', flow(({ db }) => TE.of(db.transaction('deal', 'readwrite')))),
    TE.bind('keys', ({ tran }) => pipe(
      TE.tryCatchK(() => tran.store.index('correlation').getAll(correlationId), (): DbError => "SelectError")(),
      TE.map(RA.map(row => row.deal.id)))),
    TE.bind('delete', ({ tran, keys }) => pipe(keys, TE.traverseArray(TE.tryCatchK(key => tran.store.delete(key), (): DbError => "DeleteError")))),
    TE.chain(({ tran }) => TE.tryCatch(() => tran.done, (): DbError => "CommitRejected")))