'use strict';

class QueryCondition{
    constructor(column,condition,value) {
        this.column = column;
        this.condition = condition;
        this.value = value;
    }
}
module.exports = QueryCondition;