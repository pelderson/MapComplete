export default {
  "type": "object",
  "properties": {
    "id": {
      "description": "An id/name for this filter, used to set the URL parameters",
      "type": "string"
    },
    "options": {
      "description": "The options for a filter\nIf there are multiple options these will be a list of radio buttons\nIf there is only one option this will be a checkbox\nFiltering is done based on the given osmTags that are compared to the objects in that layer.\n\nAn example which searches by name:\n\n```\n{\n      \"id\": \"shop-name\",\n      \"options\": [\n        {\n          \"fields\": [\n            {\n              \"name\": \"search\",\n              \"type\": \"string\"\n            }\n          ],\n          \"osmTags\": \"name~i~.*{search}.*\",\n          \"question\": {\n            \"en\": \"Only show shops with name {search}\",\n          }\n        }\n      ]\n    }\n    ```",
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "question": {},
          "osmTags": {
            "description": "The main representation of Tags.\nSee https://github.com/pietervdvn/MapComplete/blob/develop/Docs/Tags_format.md for more documentation",
            "anyOf": [
              {
                "$ref": "#/definitions/AndTagConfigJson",
                "description": "Chain many tags, to match, a single of these should be true\nSee https://github.com/pietervdvn/MapComplete/blob/develop/Docs/Tags_format.md for documentation"
              },
              {
                "$ref": "#/definitions/OrTagConfigJson",
                "description": "Chain many tags, to match, all of these should be true\nSee https://github.com/pietervdvn/MapComplete/blob/develop/Docs/Tags_format.md for documentation"
              },
              {
                "type": "string"
              }
            ]
          },
          "default": {
            "type": "boolean"
          },
          "fields": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "name": {
                  "description": "If name is `search`, use  \"_first_comment~.*{search}.*\" as osmTags",
                  "type": "string"
                },
                "type": {
                  "type": "string"
                }
              },
              "required": [
                "name"
              ]
            }
          }
        },
        "required": [
          "question"
        ]
      }
    },
    "#": {
      "description": "Used for comments or to disable a check\n\n\"ignore-possible-duplicate\": disables a check in `DetectDuplicateFilters` which complains that a filter can be replaced by a filter from the `filters`-library-layer",
      "type": "string"
    }
  },
  "required": [
    "id",
    "options"
  ],
  "definitions": {
    "TagConfigJson": {
      "description": "The main representation of Tags.\nSee https://github.com/pietervdvn/MapComplete/blob/develop/Docs/Tags_format.md for more documentation",
      "anyOf": [
        {
          "$ref": "#/definitions/AndTagConfigJson"
        },
        {
          "description": "Chain many tags, to match, all of these should be true\nSee https://github.com/pietervdvn/MapComplete/blob/develop/Docs/Tags_format.md for documentation",
          "type": "object",
          "properties": {
            "or": {
              "type": "array",
              "items": {
                "$ref": "#/definitions/TagConfigJson"
              }
            }
          },
          "required": [
            "or"
          ]
        },
        {
          "type": "string"
        }
      ]
    },
    "AndTagConfigJson": {
      "description": "Chain many tags, to match, a single of these should be true\nSee https://github.com/pietervdvn/MapComplete/blob/develop/Docs/Tags_format.md for documentation",
      "type": "object",
      "properties": {
        "and": {
          "type": "array",
          "items": {
            "$ref": "#/definitions/TagConfigJson"
          }
        }
      },
      "required": [
        "and"
      ]
    },
    "OrTagConfigJson": {
      "description": "Chain many tags, to match, all of these should be true\nSee https://github.com/pietervdvn/MapComplete/blob/develop/Docs/Tags_format.md for documentation",
      "type": "object",
      "properties": {
        "or": {
          "type": "array",
          "items": {
            "$ref": "#/definitions/TagConfigJson"
          }
        }
      },
      "required": [
        "or"
      ]
    }
  },
  "$schema": "http://json-schema.org/draft-07/schema#"
}