jQuery(function ($) {

//knockout singleton
//var ko = ko;

//instanciate nicEditor
var nicEdit;

/** extend knockout */
//contenteditable
ko.bindingHandlers.htmlValue = {
    init: function(element, valueAccessor, allBindingsAccessor) {
        ko.utils.registerEventHandler(element, "blur", function() {
            var modelValue = valueAccessor();
            var elementValue = element.innerHTML;
            if (ko.isWriteableObservable(modelValue)) {
                modelValue(elementValue);
            } else { //handle non-observable one-way binding
                var allBindings = allBindingsAccessor();
                if (allBindings['_ko_property_writers'] && allBindings['_ko_property_writers'].htmlValue) allBindings['_ko_property_writers'].htmlValue(elementValue);
            }
        });
        
        //edit by nickEdit
        nicEdit.addInstance(element);
    },
    update: function(element, valueAccessor) {
        var value = ko.utils.unwrapObservable(valueAccessor()) || "";
        element.innerHTML = value;
    }
};

//draggable
ko.bindingHandlers.positionOffset = {
    init: function (element, valueAccessor) {
        var position = ko.utils.unwrapObservable(valueAccessor());
        jQuery(element).draggable({
            handle: '>.drag-handle',
            drag: function (e, ui) {
                position.left(ui.position.left);
                position.top(ui.position.top);
            }
        }).css({
            left: position.left(),
            top: position.top()
        });
    },
    update: function(element, valueAccessor) {
        var position =  ko.utils.unwrapObservable(valueAccessor());
        if (typeof (position) === 'function') {
            position = position();
        }
        jQuery(element).css({left: position.left, top: position.top});
    }
}

/** viewmodels */
function SceneVM (data) {
    var self = this;
    
    if ('_id' in data) self._id = data._id;
    
    self.title = ko.observable(data.title || '');
    self.titleEditing = ko.observable(false);
    self.editTitle = function () {
        self.titleEditing(true);
    };
    
    self.content = ko.observable(data.content);
    
    self.saveForm = function (data) {
        var ns = 'scenes';
        data[ns] = data[ns] || [];
        var mine = {title: self.title, content: self.content};
        if ('_id' in self) {
            mine['_id'] = self._id;
        }
        data[ns].push(mine);
    };
}

function AnnnotationVM (data) {
    var self = this;
    
    self.position = ko.observable({
        left: ko.observable(data.position.left),
        top: ko.observable(data.position.top)
    });
    
    self.content = ko.observable(data.content);
}

function ProjectVM() {
    var self = this;
    self.scenes = ko.observableArray([]);
    
    self.annotations = ko.observableArray([
        new AnnnotationVM({position: { left: 10, top: 10 }, content: '...'})
    ]);
    
    self.save = function () {
        var data = {};
        ko.utils.arrayForEach(ko.utils.unwrapObservable(self['scenes']), function (item) { item.saveForm(data); });
        $.ajax({
            url: '/projects/1',
            type: 'post',
            contentType: 'application/json',
            data: ko.toJSON(data)
        })
    };
    
    self.load = function () {
        $.getJSON('projects/1/scenes.json', function (response) {
            self.scenes(
                $.map(response, function (data) { return new SceneVM(data); })
            );
        });
    };
}


nicEdit = new nicEditor({
    buttonList : [
        'forecolor', 'bold','italic','underline', 'link', 'unlink',
        'indent', 'outdent',
        'left', 'center', 'right', 'justify',
        'ol', 'ul', 
        'hr', /*'image', 'upload',*/
        'xhtml'
    ],
    //TODO, iconPath: '',

});

var theProject = new ProjectVM();
theProject.load();
ko.applyBindings(theProject);

/* create panel with save action of the project view-model */
nicEdit.setPanel('myNicPanel');
//TODO: bind save

});
