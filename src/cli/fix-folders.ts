import chalk from 'chalk';
// import { MongoClient } from 'mongodb';
import { config } from '../configuration';
// import { V3MongoBlock } from '../utils/v3';
import { readBlockFiles } from '../loader';
import { V3MongoBlock } from '../utils/v3';
import { Db, MongoClient } from 'mongodb';

// async function migrateBlocks() {
//   const localBlocks = await readBlockFiles(config.blocksDir);
// }

async function getMongoDbConnection(): Promise<Db> {
  const mongoConn = await new MongoClient(config.mongoConn).connect();
  return mongoConn.db(config.mongoDbName);
}

export async function fixDbBlockFolders(safeRun: boolean = true) {
  console.log(chalk.red(`Running in ${safeRun ? 'SAFE' : 'WRITE TO DB'} mode!`));

  console.log(`Reading files to migrate from  ${config.blocksDir} folder`);

  let localBlocks = await readBlockFiles(config.blocksDir);

  console.log(`Got ${localBlocks.length} files to migrate`);

  const db = await getMongoDbConnection();

  let i = 0;
  const blockCollection = db
    .collection<V3MongoBlock>('blocks');

  for (const block of localBlocks) {
    console.log(`Updating ${i + 1}/${localBlocks.length}`);

    try {
      if(!safeRun) {
        const res = await blockCollection
          .updateOne({ _id: block.metadata['_id'] }, { $set: { Folder: block.path.folder } }, { upsert: true });
        console.log(`Updated ${i + 1}/${localBlocks.length}, ${res.modifiedCount ? 'modified' : 'created ' + res.upsertedCount}`);
      }
      else{
        let dbBlock = await blockCollection
          .findOne({ _id: block.metadata['_id'] });

        if(!dbBlock){
          dbBlock = {
            //@ts-ignore
            '_id': 'new',
            'Folder': ''
          }
        }

        console.log(`Updated ${i + 1}/${localBlocks.length}, id: ${dbBlock?._id}, ${dbBlock?.Folder} -> ${block.path.folder}`);
      }
    } catch (err) {
      console.log(`Error on ${i + 1}/${localBlocks.length}`);
      console.error(err);
    }

    i++;
  }

  console.log(chalk.green('\nFolders fixed complete successfully!'));
}