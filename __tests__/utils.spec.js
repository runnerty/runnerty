const utils = require("../lib/utils");
const encrypt = utils.encrypt;
const decrypt = utils.decrypt;
const loadConfigSection = utils.loadConfigSection;

const basic_config_mockup = { 
  executors: [ { id: "shell_default", type: "@runnerty-executor-shell" } ],
  general: { 
    api:{ 
      port: 3456,
      secret: "YOUR_SECRET",
      limite_req: "20mb",
      propertiesExcludesInResponse: [Array] },
    planFilePath: "~/plan.json" 
  },
  notifiers: [],
  global_values: [],
  historyEnabled: false };

const basic_config_mockup_cryptoPassword = { 
  executors: [ { id: "shell_default", type: "@runnerty-executor-shell", crypted_password:"test" } ],
  general: { 
    api:{ 
      port: 3456,
      secret: "YOUR_SECRET",
      limite_req: "20mb",
      propertiesExcludesInResponse: [Array] },
    planFilePath: "~/plan.json" 
  },
  notifiers: [],
  global_values: [],
  historyEnabled: false 
};
  
describe("Encrypt", () => {
  test("It should encrypt the string Coderty", () => {
    expect(encrypt("Coderty", "password")).toBe("e86ad3e3633795");
  });

  test("It should decrypt the string Coderty", () => {
    expect(decrypt("e86ad3e3633795", "password")).toBe("Coderty");
  });
});

describe("loadConfigSection function", () => {

  it("It should throw an error when config is undefined", async () => {
    try {
      await loadConfigSection();
    } catch (e) {
      expect(e).toBe("Error: config must be defined.");
    }
  });

  it("It should throw an error when the section is not defined in the config file", async () => {
    await expect( loadConfigSection({}, "executors") ).rejects.toEqual("Section executors not found in config file.");
  });

  it("It should throw an error when the section is not defined in the config file", async () => {
    await expect( loadConfigSection(basic_config_mockup, "fake_section", "id_config") ).rejects.toEqual("Section fake_section not found in config file.");
  });

  it("It should throw an error when the id_config is not defined", async () => {
    await expect( loadConfigSection(basic_config_mockup, "executors") ).rejects.toEqual("Config for undefined not found in section executors");
  });

  it("It should throw an error when the id_config is not found", async () => {
    await expect( loadConfigSection(basic_config_mockup, "executors", "fake_id_config") ).rejects.toEqual("Config for fake_id_config not found in section executors");
  });

  it("It should return an object with the config section", async () => {
    await expect( loadConfigSection(basic_config_mockup, "executors", "shell_default") ).resolves.toEqual( { id: "shell_default", type: "@runnerty/executor-shell" } );
  });
  
  it("It should throw an exception if crypted_password is defined but global.cryptoPassword is not defined", async () => {
    await expect( loadConfigSection(basic_config_mockup_cryptoPassword, "executors", "shell_default") ).rejects.toEqual( "No crypto password set for encrypt crypted_password of section executors id shell_default." );
  });
  
  it("It should works", async () => {
    global.cryptoPassword = "CODERTY";
    await expect( loadConfigSection(basic_config_mockup_cryptoPassword, "executors", "shell_default") ).resolves.toEqual( {"crypted_password": "test", "id": "shell_default", "password": "", "type": "@runnerty/executor-shell"} );
  });

});