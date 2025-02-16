'use strict';

const _ = require('lodash');
const presets = require('versionist/lib/presets');


let commits;

const VALID_INCREMENT_LEVELS = [
  'prerelease',
  'prepatch',
  'preminor',
  'premajor',
  'patch',
  'minor',
  'major',
];

const isValidIncrementLevel = (level) => {
  return _.includes(VALID_INCREMENT_LEVELS, level.toLowerCase());
};

const getChangeType = (footer) => {
  return footer[
    Object.keys(footer).find((k) => k.toLowerCase() === '__change-type')
  ];
};

const isIncrementalCommit = (changeType) => {
  return Boolean(changeType) && changeType.trim().toLowerCase() !== 'none';
};

const getHigherIncrementLevel = (firstLevel, secondLevel) => {
  _.each([firstLevel, secondLevel], (level) => {
    if (level != null && !isValidIncrementLevel(level)) {
      throw new Error(`Invalid increment level: ${level}`);
    };
  });

  if (!firstLevel && !secondLevel) {
    return null;
  };

  const firstLevelIndex = _.indexOf(
    VALID_INCREMENT_LEVELS,
    firstLevel?.toLowerCase(),
  );
  const secondLevelIndex = _.indexOf(
    VALID_INCREMENT_LEVELS,
    secondLevel?.toLowerCase(),
  );

  return VALID_INCREMENT_LEVELS[Math.max(firstLevelIndex, secondLevelIndex)];
};

const calculateNextIncrementLevel = (commits, options) => {
  _.defaults(options, {
    getIncrementLevelFromCommit: getIncrementLevelFromCommit(),
  });

  if (_.isEmpty(commits)) {
    throw new Error('No commits to calculate the next increment level from');
  };

  const incrementCommit = _.reduce(
    commits,
    (currentCommit, commit) => {
      const commitLevel = options.getIncrementLevelFromCommit(commit);
      const level = getHigherIncrementLevel(commitLevel, currentCommit.level);
      if (level === currentCommit.level) {
        commit = currentCommit.commit;
      };
      return { level: level, commit: commit };
    },
    {},
  );

  return incrementCommit;
};

const getIncrementLevelFromCommit = (preset) => {
  _.defaults(preset, 'default');
  if (_.includes([
    'change-type',
    'subject',
    'change-type-or-subject',
  ], preset)) {
    return (commit) => {
      const changeType = presets.getIncrementLevelFromCommit[preset]({}, commit);
      return changeType;
    };
  };
  return (commit) => {
    const changeType = getChangeType(commit.footer);
    if (isIncrementalCommit(changeType)) {
      return changeType.trim().toLowerCase();
    };
  };
};

module.exports = {
  getCurrentBaseVersion: (documentedVersions, history, callback) => {
    commits = history;
    return presets.getCurrentBaseVersion[
      'latest-documented'
    ]({}, documentedVersions, history, callback);
  },

  getIncrementLevelFromCommit: 'change-type',

  incrementVersion: (version, incrementLevel) => {
    const incrementCommit = calculateNextIncrementLevel(commits, {
      getIncrementLevelFromCommit: getIncrementLevelFromCommit(),
    });

    if (getIncrementLevelFromCommit('change-type')(incrementCommit.commit) === 'patch') {
      incrementLevel = incrementCommit.level;
    };

    const incrementedVersion = presets.incrementVersion.semver({}, version, incrementLevel);

    return incrementedVersion;
  },

  includeCommitWhen: 'has-changetype',
};
