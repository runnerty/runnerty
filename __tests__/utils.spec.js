const utils = require('../lib/utils');
const encrypt = utils.encrypt;
const decrypt = utils.decrypt;
const loadConfigSection = utils.loadConfigSection;

const basic_config_mockup = {
  executors: [{ id: 'shell_default', type: '@runnerty/executor-shell' }],
  general: {
    api: {
      port: 3456,
      secret: 'YOUR_SECRET',
      limite_req: '20mb',
      propertiesExcludesInResponse: [Array]
    },
    planFilePath: '~/plan.json'
  },
  notifiers: [],
  global_values: [],
  historyEnabled: false
};

describe('Encrypt', () => {
  /*
  test('It should encrypt the string Coderty', () => {
    expect(
      encrypt('Coderty', 'password00000000password00000000', 'aes-256-cbc')
    ).toBe('68507eea5bdfb60b392f7c43099c2ca4');
  });
  */

  test('It should decrypt the string Coderty', () => {
    expect(
      decrypt(
        '6ff2432e1964c661d599e5c5fee4f4d8:37a1dcdd0a27151e1dcc59b52d0e479b',
        'password00000000password00000000',
        'aes-256-cbc'
      )
    ).toBe('Coderty');
  });
});

describe('loadConfigSection function', () => {
  it('It should throw an error when config is undefined', async () => {
    try {
      await loadConfigSection();
    } catch (e) {
      expect(e).toBe('Error: config must be defined.');
    }
  });

  it('It should throw an error when the section is not defined in the config file', async () => {
    await expect(loadConfigSection({}, 'executors')).rejects.toEqual(
      'Section executors not found in config file.'
    );
  });

  it('It should throw an error when the section is not defined in the config file', async () => {
    await expect(
      loadConfigSection(basic_config_mockup, 'fake_section', 'id_config')
    ).rejects.toEqual('Section fake_section not found in config file.');
  });

  it('It should throw an error when the id_config is not defined', async () => {
    await expect(
      loadConfigSection(basic_config_mockup, 'executors')
    ).rejects.toEqual('Config for undefined not found in section executors');
  });

  it('It should throw an error when the id_config is not found', async () => {
    await expect(
      loadConfigSection(basic_config_mockup, 'executors', 'fake_id_config')
    ).rejects.toEqual(
      'Config for fake_id_config not found in section executors'
    );
  });

  it('It should return an object with the config section', async () => {
    await expect(
      loadConfigSection(basic_config_mockup, 'executors', 'shell_default')
    ).resolves.toEqual({
      id: 'shell_default',
      type: '@runnerty/executor-shell'
    });
  });
});
