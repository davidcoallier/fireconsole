

function dump(obj) { print(require('test/jsdump').jsDump.parse(obj)) };



var UTIL = require("util");
var JSON = require("json");

var Encoder = exports.Encoder = function() {
    if (!(this instanceof exports.Encoder))
        return new exports.Encoder();
    this.options = {
        "maxObjectDepth": 8,
        "maxArrayDepth": 8,
        "maxOverallDepth": 10,
        "includeLanguageMeta": true
    };
}

Encoder.prototype.setOption = function(name, value) {
    this.options[name] = value;
}

Encoder.prototype.setOrigin = function(variable) {
    this.origin = variable;
    // reset some variables
    this.instances = [];
    return true;
}

Encoder.prototype.encode = function(data, meta, options) {

    options = options || {};

    if(typeof data != "undefined") {
        this.setOrigin(data);
    }

    // TODO: Use meta["fc.encoder.options"] to control encoding

    var graph = {};

    if(typeof this.origin != "undefined") {
        graph["origin"] = this.encodeVariable(this.origin);
    }

    if(UTIL.len(this.instances)>0) {
        graph["instances"] = [];
        this.instances.forEach(function(instance) {
            graph["instances"].push(instance[1]);
        });
    }

    if(UTIL.has(options, "jsonEncode") && !options.jsonEncode) {
        return graph;
    }

    return JSON.encode(graph);
}

Encoder.prototype.encodeVariable = function(variable, objectDepth, arrayDepth, overallDepth) {
    objectDepth = objectDepth || 1;
    arrayDepth = arrayDepth || 1;
    overallDepth = overallDepth || 1;
    
    if(variable===null) {
        var ret = {"type": "constant", "constant": "null"};
        if(this.options["includeLanguageMeta"]) {
            ret["fc.lang.type"] = "null";
        }
        return ret;
    } else
    if(variable===true || variable===false) {
        var ret = {"type": "constant", "constant": (variable===true)?"true":"false"};
        if(this.options["includeLanguageMeta"]) {
            ret["fc.lang.type"] = "boolean";
        }
        return ret;
    }
    var type = typeof variable;
    if(type=="number") {
        var ret = {"type": "text", "text": variable};
        if(this.options["includeLanguageMeta"]) {
            ret["fc.lang.type"] = "number";
        }
        return ret;
    } else
    if(type=="string") {
        var ret = {"type": "text", "text": variable};
        if(this.options["includeLanguageMeta"]) {
            ret["fc.lang.type"] = "string";
        }
        return ret;
    } else
    if(type=="object") {
        if(UTIL.isArrayLike(variable)) {
            return {
                "type": "array",
                "array": this.encodeArray(variable, objectDepth, arrayDepth, overallDepth)
            };
        } else {
            return {
                "type": "reference",
                "reference": this.encodeInstance(variable, objectDepth, arrayDepth, overallDepth)
            };
        }
    }

    return "["+(typeof variable)+"]["+variable+"]";    
}

Encoder.prototype.encodeArray = function(variable, objectDepth, arrayDepth, overallDepth) {
    objectDepth = objectDepth || 1;
    arrayDepth = arrayDepth || 1;
    overallDepth = overallDepth || 1;
    if(arrayDepth > this.options["maxArrayDepth"]) {
        return {"notice": "Max Array Depth (" + this.options["maxArrayDepth"] + ")"};
    } else
    if(overallDepth > this.options["maxOverallDepth"]) {
        return {"notice": "Max Overall Depth (" + this.options["maxOverallDepth"] + ")"};
    }
    var self = this,
        items = [];
    UTIL.forEach(variable, function(item) {
        items.push(self.encodeVariable(item, 1, arrayDepth + 1, overallDepth + 1));
    });
    return items;
}

Encoder.prototype.getInstanceId = function(object) {
    for( var i=0 ; i<this.instances.length ; i++ ) {
        if(this.instances[i][0]===object) {
            return i;
        }
    }
    return null;
}

Encoder.prototype.encodeInstance = function(object, objectDepth, arrayDepth, overallDepth) {
    objectDepth = objectDepth || 1;
    arrayDepth = arrayDepth || 1;
    overallDepth = overallDepth || 1;
    var id = this.getInstanceId(object);
    if(id!=null) {
        return id;
    }
    this.instances.push([
        object,
        this.encodeObject(object, objectDepth, arrayDepth, overallDepth)
    ]);
    return UTIL.len(this.instances)-1;
}

Encoder.prototype.encodeObject = function(object, objectDepth, arrayDepth, overallDepth) {
    objectDepth = objectDepth || 1;
    arrayDepth = arrayDepth || 1;
    overallDepth = overallDepth || 1;

    if(arrayDepth > this.options["maxObjectDepth"]) {
        return {"notice": "Max Object Depth (" + this.options["maxObjectDepth"] + ")"};
    } else
    if(overallDepth > this.options["maxOverallDepth"]) {
        return {"notice": "Max Overall Depth (" + this.options["maxOverallDepth"] + ")"};
    }
    
    var self = this,
        ret = {"type": "dictionary", "dictionary": {}};
    
    UTIL.every(object, function(item) {
        try {
            if(item[0]=="__fc_tpl_id") {
                ret['fc.tpl.id'] = item[1];
                return;
            }
            ret["dictionary"][item[0]] = self.encodeVariable(item[1], objectDepth + 1, 1, overallDepth + 1);
        } catch(e) {
            ret["dictionary"]["__oops__"] = {"notice": "Error encoding member (" + e + ")"};
        }
    });
    
    return ret;
}