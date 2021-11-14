import { option, readonlyArray as RA, string, taskEither as TE } from 'fp-ts';
import { flow, pipe } from 'fp-ts/lib/function';
import { DBSchema, IDBPDatabase, IDBPTransaction, IndexNames, openDB, StoreNames } from 'idb';
import { UuidTool } from 'uuid-tool';

import { ConstrainedBidPathHash, GenerationId } from '../model/job';
import { SerializedDeal } from '../model/serialization';
import { DoubleDummyTable } from '../workers/dds.worker';

interface DealDB extends DBSchema {
  deal: {
    key: SerializedDeal["id"]
    value: {
      deal: SerializedDeal
      batchId: string
      generationId: GenerationId
      solution?: DoubleDummyTable
    },
    indexes: {
      'batch': string,
      'generation': string
    }
  },
  satisfies: {
    key: [GenerationId, ConstrainedBidPathHash]
    value: {
      generationId: GenerationId
      deals: ReadonlyArray<SerializedDeal>
    },
    indexes: {
      'generation': string
    }
  }
}

type DbError =
  | "OpenDatabaseFailed"
  | "CommitRejected"
  | "InsertError"
  | "SelectError"
  | "DeleteError"

const getDb =
  TE.tryCatch(
    () => openDB<DealDB>('bridge', 1, {
      upgrade: (db) => {
        const deal = db.createObjectStore("deal")
        deal.createIndex('batch', 'batchId')
        deal.createIndex('generation', 'generationId')
        const satisfies = db.createObjectStore("satisfies")
        satisfies.createIndex('generation', 'generationId')
      }
    }),
    (): DbError => "OpenDatabaseFailed")

export const insertDeals = (generationId: GenerationId) => (deals: ReadonlyArray<SerializedDeal>) =>
  pipe(getDb,
    TE.map(db => db.transaction('deal', 'readwrite')),
    TE.chainFirst(tran => {
      const batchId = UuidTool.newUuid()
      return pipe(deals, TE.traverseArray(deal =>
        TE.tryCatch(
          () => tran.store.put({
            deal,
            generationId,
            batchId
          }, deal.id),
          (): DbError => "InsertError")))
    }),
    TE.chain(tran => TE.tryCatch(() => tran.done, (): DbError => "CommitRejected")))

export const insertSatisfies = (generationId: GenerationId, hash: ConstrainedBidPathHash) => (deals: ReadonlyArray<SerializedDeal>) =>
  pipe(getDb,
    TE.map(db => db.transaction('satisfies', 'readwrite')),
    TE.bindTo('tran'),
    TE.bind('existingDeals', ({ tran }) => pipe(
      TE.tryCatch(() => tran.store.get([generationId, hash]), (): DbError => "SelectError"),
      TE.map(flow(option.fromNullable, option.fold(() => [], r => r.deals))))),
    TE.chainFirst(({ tran, existingDeals }) =>
      TE.tryCatch(() => tran.store.put({
        generationId,
        deals: pipe(existingDeals, RA.concat(deals))
      }, [generationId, hash]), (): DbError => "InsertError")),
    TE.chain(({ tran }) => TE.tryCatch(() => tran.done, (): DbError => "CommitRejected")))

const getByIndex = <I extends IndexNames<DealDB, 'deal'>>(idx: I) => (id: string) =>
  TE.tryCatchK((db: IDBPDatabase<DealDB>) => db.getAllFromIndex('deal', idx, id), (): DbError => "SelectError")

export const getDealsByGenerationId = (generationId: GenerationId) =>
  pipe(getDb,
    TE.chain(getByIndex('generation')(generationId)),
    TE.map(RA.map(row => row.deal)))

export const getBatchIdsByGenerationId = (generationId: GenerationId) =>
  pipe(getDb,
    TE.chain(getByIndex('generation')(generationId)),
    TE.map(flow(
      RA.map(row => row.batchId),
      RA.uniq(string.Eq))))

export const getDealsByBatchId = (batchId: string) =>
  pipe(getDb,
    TE.chain(getByIndex('batch')(batchId)),
    TE.map(RA.map(row => row.deal)))

export const deleteByGenerationId = (generationId: GenerationId) =>
  pipe(getDb,
    TE.chain(db => TE.of(db.transaction(['deal', 'satisfies'], 'readwrite'))),
    TE.chainFirst(tran => pipe(
      TE.tryCatch(() => tran.objectStore('deal').index('generation').getAllKeys(generationId), (): DbError => "SelectError"),
      TE.chain(TE.traverseArray(TE.tryCatchK(key => tran.objectStore('deal').delete(key), (): DbError => "DeleteError"))))),
    TE.chainFirst(tran => pipe(
      TE.tryCatch(() => tran.objectStore('satisfies').index('generation').getAllKeys(generationId), (): DbError => "SelectError"),
      TE.chain(TE.traverseArray(TE.tryCatchK(key => { return tran.objectStore('satisfies').delete(key) }, (): DbError => "DeleteError"))))),
    TE.chain(tran => TE.tryCatch(() => tran.done, (): DbError => "CommitRejected")))