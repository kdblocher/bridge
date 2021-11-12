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
      collectionId?: string
    },
    indexes: {
      'batch': string,
      'job': string
    }
  },
}

type DbError =
  | "OpenDatabaseFailed"
  | "CommitRejected"
  | "InsertError"
  | "SelectError"

const getDb =
  TE.tryCatch(
    () => openDB<DealDB>('bridge', 2, {
      upgrade: (db) => {
        // db.deleteObjectStore("deal")
        const store = db.createObjectStore("deal")
        store.createIndex('batch', 'batchId')
        store.createIndex('job', 'collectionId')
      }
    }),
    (): DbError => "OpenDatabaseFailed")

export const insertDeals = (collectionId?: string) => (deals: ReadonlyArray<SerializedDeal>) =>
  pipe(getDb,
    TE.map(db => db.transaction('deal', 'readwrite')),
    TE.chainFirst(tran => {
      const batchId = UuidTool.newUuid()
      return pipe(deals, TE.traverseArray(deal =>
      TE.tryCatch(
        () => tran.store.put({
          deal,
          collectionId,
          batchId
        }, deal.id),
        (): DbError => "InsertError")))
    }),
    TE.chain(tran => TE.tryCatch(() => tran.done, (): DbError => "CommitRejected")))

const getByIndex = <I extends IndexNames<DealDB, 'deal'>>(idx: I) => (id: string) =>
  TE.tryCatchK((db: IDBPDatabase<DealDB>) => db.getAllFromIndex('deal', idx, id), (): DbError => "SelectError")

export const getDealsByJobId = (collectionId: string) =>
  pipe(getDb,
    TE.chain(getByIndex('job')(collectionId)),
    TE.map(RA.map(row => row.deal)))

export const getBatchIdsByJobId = (collectionId: string) =>
  pipe(getDb,
    TE.chain(getByIndex('job')(collectionId)),
    TE.map(flow(
      RA.map(row => row.batchId),
      RA.uniq(string.Eq))))

export const getDealsByBatchId = (batchId: string) =>
  pipe(getDb,
    TE.chain(getByIndex('batch')(batchId)),
    TE.map(RA.map(row => row.deal)))