const { Sequelize, DataTypes } = require('sequelize');
const { Umzug, SequelizeStorage } = require('umzug');
const path = require('path');
const { app } = require('electron');
const os = require('os');
const fs = require('fs');
const { tableName, columns } = require('./constants');

const dbPath = path.join(app.getPath('appData'), `/${app.name}/db/recording-v2.db`);

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: dbPath,
});

const getMigrationFiles = () => {
  const baseLocation = path.join(__dirname, './migrations');
  const migrationFiles = fs.readdirSync(baseLocation);
  return migrationFiles.map((fileName) => {
    const {up, down} = require(path.join(baseLocation, fileName));
    return {up, down, name: fileName};
  })
}

const umzug = new Umzug({
  migrations: getMigrationFiles(),
  storage: new SequelizeStorage({
    sequelize,
  }),
  context: sequelize.getQueryInterface(),
});

const Upload = sequelize.define(tableName, {
  [columns.id]: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  [columns.quizId]: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  [columns.userId]: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  [columns.data]: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  [columns.uploaded]: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  [columns.max_wait]: {
    type: DataTypes.DATE,
  },
});

const initDataBase = async () => {
  try {
    await sequelize.authenticate();
    await umzug.up();
    console.log('Database connected and migrations run successfully!');
  } catch (error) {
    console.error('Error connecting to the database or running migrations:', error);
  }
};

module.exports = { initDataBase, db: Upload };
