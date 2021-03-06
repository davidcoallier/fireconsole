

function dump(obj) { print(require('test/jsdump').jsDump.parse(obj)) };


var UTIL = require("util");
var SANDBOX = require("sandbox").Sandbox;
var LOADER = require("loader").Loader;
var PACKAGES = require("packages");
var DOMPLATE = require("domplate", "domplate");
var JAR_LOADER = require("jar-loader");

var sandbox;
var sandboxModules;
var sandboxBaseModules;
var sandboxRequire;
var sandboxDirty = true;
var sandboxPackages = [];
var repositoryPaths = [];
var loadedPacks = {};


var externalLogger,
    externalEventDispatcher;
exports.setLogger = function(logger) {
    externalLogger = logger;
}
exports.setEventDispatcher = function(dispatcher) {
    externalEventDispatcher = dispatcher;
}
var logger = {
    log: function() {
        if(externalLogger) externalLogger.log.apply(null, arguments);
    },
    warn: function() {
        if(externalLogger) externalLogger.warn.apply(null, arguments);
    },
    error: function() {
        if(externalLogger) externalLogger.error.apply(null, arguments);
    }
}
var eventDispatcher = {
    dispatch: function(name, args) {
        if(externalEventDispatcher) externalEventDispatcher.dispatch.apply(null, arguments);
    }
}


// HACK: Until the template referencing is refactored
var idMappings;
exports.setIdMappings = function(mappings) {
    idMappings = mappings;
}


exports.markSandboxDirty = function() {
    sandboxDirty = true;
}

exports.addSandboxPackage = function(name) {
    sandboxPackages.push(name);
    // Mark the sandbox as dirty to re-create it when the next template pack is loaded
    sandboxDirty = true;
}

exports.addRepositoryPath = function(file) {
    repositoryPaths.push(file);
    // Mark the sandbox as dirty to re-create it when the next template pack is loaded
    sandboxDirty = true;
}


function getLogger() {
    if(!logger) {
        logger = {
            log: function() {},
            warn: function() {},
            error: function() {}
        }
    }
    return logger;
}


exports.requirePack = function(id, force, notSandboxed, externalLoader) {
    if(force || !UTIL.has(loadedPacks, id)) {
        loadedPacks[id] = loadTemplatePack(id, force, notSandboxed);
    }
    var pack = loadedPacks[id].newInstance();
    pack.setExternalLoader(externalLoader);
    return pack;
}

function loadTemplatePack(id, force, notSandboxed) {
        
    // HACK: Until the template referencing is refactored
    if(id=="registry.pinf.org/cadorn.org/github/fireconsole/packages/firefox-extension/packages/reps/master") {
        id = idMappings["reps"];
    } else
    if(id=="registry.pinf.org/cadorn.org/github/fireconsole-template-packs/packages/lang-php/master") {
        id = idMappings["lang-php"];
    } else
    if(id=="registry.pinf.org/cadorn.org/github/fireconsole-template-packs/packages/fc-object-graph/master") {
        id = idMappings["fc-object-graph"];
    }
       
    if(notSandboxed) {
        return require("_pack_", id).Pack();
    }

    // Establish a sandbox for all template packs
    // If the sandbox is marked dirty we re-create it
    if(force || sandboxDirty) {

        function loadPackages() {
            var paths = UTIL.copy(repositoryPaths);
            sandboxPackages.forEach(function(name) {
                paths.push(PACKAGES.catalog[name].directory);
            });
            paths.push("chrome://narwhal-xulrunner/content/narwhal");
            sandboxRequire("packages").load(paths);
            sandboxDirty = false;
        }
        
        if(!sandbox) {
            var ssystem = UTIL.copy(require("system"));
            // Load minimal system
            var loader = LOADER({
                "paths": [
                    "chrome://narwhal-xulrunner/content/lib",
                    "chrome://narwhal-xulrunner/content/narwhal/engines/default/lib",
                    "chrome://narwhal-xulrunner/content/narwhal/lib"
                ]
            });
            sandboxModules = {
                "system": ssystem,
                // TODO: This needs to be moved out of this module and package to make it more generic
                "jar-loader": JAR_LOADER        // prevents module from being re-loaded in the sandbox
            };
            sandbox = SANDBOX({
                "system": ssystem,
                "loader": loader,
                "modules": sandboxModules
            });
            sandbox.force("system");
            sandboxRequire = function(id, pkg) {
                return sandbox(id, null, pkg);
            }
            sandboxRequire("global");
            loadPackages();
            sandboxBaseModules = {};
            UTIL.keys(sandboxModules).forEach(function(id) {
                sandboxBaseModules[id] = true;
            });
        } else {
            // TODO: Only reload template pack that needs reloading (at the moment we reload all template packs)
            UTIL.keys(sandboxModules).forEach(function(id) {
                if(!sandboxBaseModules[id]) {
                    delete sandboxModules[id];
                }
            });
            if(sandboxDirty) {
                loadPackages();
            }
        }

        var sPACK = sandboxRequire("pack", module["package"]);       
        sPACK.setLogger(logger);
        sPACK.setEventDispatcher(eventDispatcher);

        var sDOMPLATE = sandboxRequire("domplate", "http://registry.pinf.org/cadorn.org/github/domplate/");
        // TODO: Potential security hole?
        sDOMPLATE.DomplateDebug.replaceInstance(DOMPLATE.DomplateDebug);
    }
    return sandboxRequire("_pack_", id).Pack();
}

