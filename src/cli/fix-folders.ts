import chalk from 'chalk';
import { config } from '../configuration';
import { readBlockFiles } from '../loader';
import { V3MongoBlock } from '../utils/v3';
import { Db, MongoClient, ObjectId } from 'mongodb';

async function getMongoDbConnection(): Promise<Db> {
  const mongoConn = await new MongoClient(config.mongoConn).connect();
  return mongoConn.db(config.mongoDbName);
}

export async function fixDbBlockFolders(safeRun = true) {
  console.log(chalk.red(`Running in ${safeRun ? 'SAFE' : 'WRITE TO DB'} mode!`));

  console.log(`Reading files to migrate from  ${config.blocksDir} folder`);

  let localBlocks = await readBlockFiles(config.blocksDir);

  localBlocks = localBlocks.filter(l => l.path.filePath.indexOf('_forked') === -1);

  console.log(`Got ${localBlocks.length} files to migrate`);

  const db = await getMongoDbConnection();

  let i = 0;
  const blockCollection = db.collection<V3MongoBlock>('blocks');

  for (const block of localBlocks) {
    console.log(`Updating ${i + 1}/${localBlocks.length}`);

    try {
      const blockId = new ObjectId(block.metadata['_id'] as string);
      if (!safeRun) {
        const res = await blockCollection.updateOne({ _id: blockId }, { $set: { Folder: block.path.folder } }, { upsert: true });
        console.log(
          `Updated ${i + 1}/${localBlocks.length}, ${blockId.toString()}, ${
            res.modifiedCount ? 'modified' : 'created ' + res.upsertedCount
          }`,
        );
      } else {
        const dbBlock = await blockCollection.findOne({ _id: blockId });
        if (dbBlock) {
          console.log(`Updated ${i + 1}/${localBlocks.length}, id: ${dbBlock?._id}, ${dbBlock?.Folder} -> ${block.path.folder}`);
        } else {
          console.log(`Created ${i + 1}/${localBlocks.length}, id: ${blockId}, Folder: ${block.path.folder}`);
        }
      }
    } catch (err) {
      console.log(`Error on ${i + 1}/${localBlocks.length}`);
      console.error(err);
    }

    i++;
  }

  console.log(chalk.green('\nFolders fixed complete successfully!'));
}
